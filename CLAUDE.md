# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

**Document Assistant** — a ChatGPT-style, per-conversation RAG chat app. Upload a document into a conversation, then ask questions answered from that conversation's documents. The full pipeline is real: text extraction → chunking → embeddings (Voyage) → vector store (Qdrant) → retrieval → generation (Anthropic Claude), with conversations/messages persisted to Supabase Postgres. See [README.md](README.md) for the feature/route tour.

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run dev:proxy    # dev server with the corporate CA trusted (see below) — use this on-network
npm run build        # production build
npm run typecheck    # tsc --noEmit  — run this to validate changes (there is no test suite)
npm run lint         # eslint
```

There is **no test runner** — `npm run typecheck` (and `npm run lint`) is the primary correctness gate. The app compiles and the UI runs with placeholder env values; auth, retrieval and generation only work once real credentials are in `.env.local`.

## Version gotchas (these break training-data assumptions — verify against installed types)

- **Next.js 16** — middleware is now `src/proxy.ts` exporting `proxy()` (not `middleware`). Route `ctx.params` and `searchParams` are `Promise`s (`await ctx.params`). Always check `node_modules/next/dist/docs/` before writing Next APIs (see AGENTS.md).
- **AI SDK v6** (`ai` ^6, `@ai-sdk/react` ^3) — `useChat` takes `transport: new DefaultChatTransport({ api })`, not `api:`; per-request data is passed via `sendMessage(msg, { body })`. For persistence, `result.toUIMessageStreamResponse()` **must** be given `originalMessages` + `generateMessageId` or the assistant message has no id and replies collide on save. Per-message data rides on `messageMetadata`. See [src/app/api/chat/route.ts](src/app/api/chat/route.ts).
- **Tailwind v4** — CSS `@import "tailwindcss"`, no `tailwind.config.js`.
- **Zod v4**, **React 19**.

## Architecture

Strict layering — a request never skips a layer:

```
Route handler / Server action  →  Service  →  supabase-js / external API clients
   (HTTP, validation)             (business boundary: ownership + DTO mapping)
```

- **No ORM / DI / repository layer.** Data access is `@supabase/supabase-js` over HTTPS/PostgREST using the cookie-bound server client ([src/lib/supabase/server.ts](src/lib/supabase/server.ts)), so **RLS scopes every row to `auth.uid()`** automatically. (The original scaffold's Prisma/DI/repository layering was removed — don't reintroduce it; extend the services.)
- **Services** ([src/services](src/services)) are the business boundary. `ConversationService` / `MessageService` persist via supabase-js and map rows → DTOs ([src/types/entities.ts](src/types/entities.ts)).
- **RAG pipeline (6 steps)**, each its own service:
  1. `ExtractTextService` — file → text (pdfreader / mammoth / word-extractor)
  2. `ChunkingService` — text → ~500-char chunks
  3. `EmbeddingsService` — chunks → vectors (Voyage `voyage-3-large`, 1024-dim, via `fetch`)
  4. `StoreChunksService` — upsert vectors into Qdrant, scoped by `conversationId`
  5. `RetrievalService` — embed the query + vector-search Qdrant for the top-K chunks
  6. `ChatService` — inject chunks into the system prompt and `streamText` from Claude (`claude-sonnet-4-6`)

  Steps **1–4 are ingest** (`POST /api/documents`, an NDJSON per-step stream). Steps **5–6 are answer** (`POST /api/chat`, an AI-SDK UI message stream). When RAG is toggled off, retrieval is skipped and the model answers alone — see `ragEnabled`.
- **API envelope**: JSON routes return `{ ok: true, data } | { ok: false, error }`. **Streaming routes do not** ([chat](src/app/api/chat/route.ts) and [documents](src/app/api/documents/route.ts) stream and handle errors inline).
- **Feature-based UI** under [src/views](src/views) (`chat`, `conversations`, `users`) — colocated components/hooks. Shared shadcn-style primitives in [src/components/ui](src/components/ui) (hand-authored — the shadcn CLI is blocked by the proxy; camelCase filenames). App shell in [src/components/layout](src/components/layout). Route groups: `src/app/(app)` (authed) and `src/app/(auth)`.
- **RAG drawer**: a client-side pipeline visualiser (right-side resizable drawer) that mirrors each step's status + payload, backed by a zustand store ([src/views/chat/rag](src/views/chat/rag)) persisted to `sessionStorage`.

### Auth model

Real **Supabase Google OAuth** (no mock user). `conversations.user_id` / message ownership reference `auth.users` directly and are enforced by **RLS** (`user_id = auth.uid()`), so a real JWT is what makes ownership work. `getCurrentUser()` ([src/lib/supabase/server.ts](src/lib/supabase/server.ts)) gates route handlers; sign-in uses a server action + `/auth/callback` (code exchange); `src/proxy.ts` refreshes the session and guards private routes.

### Persistence

Schema lives in [supabase/schema.sql](supabase/schema.sql) and must be **run once by hand in the Supabase Dashboard → SQL Editor** (DDL can't go through the proxy — see below). Tables: `conversations` and `messages` (a whole AI-SDK `UIMessage` per row, `parts` as `jsonb`), with RLS policies + grants. Persistence in `/api/chat` and page loads is **best-effort** (wrapped in try/catch) so chat still streams before the migration is applied.

## Corporate / TLS-intercepting proxy

This was built behind a corporate DLP proxy that intercepts TLS. Two consequences:

1. **Outbound HTTPS from Node fails** with `unable to get local issuer certificate` until the system CAs are trusted. Use `npm run dev:proxy` ([scripts/with-corp-ca.sh](scripts/with-corp-ca.sh)) which exports the system CAs and sets `NODE_EXTRA_CA_CERTS` — this **adds** trust, it does **not** disable TLS verification (never set `NODE_TLS_REJECT_UNAUTHORIZED=0`). Any external call from Node (Voyage, Qdrant, Anthropic, Supabase) needs this on-network.
2. **Raw Postgres is unusable** here (the pooler's TLS is intercepted; the direct host is IPv6-only), which is why data access is supabase-js over HTTPS and DDL is applied by hand — not Prisma/`pg`.

If a tool fails downloading a binary or making an API call on this machine, suspect the proxy, not a transient error.
