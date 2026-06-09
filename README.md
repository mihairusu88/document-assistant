# Document Assistant

A ChatGPT-style **RAG chat app**: upload a document into a conversation, then ask questions answered from that document. Retrieval is scoped **per conversation**, so each thread only draws on the files you added to it. A live pipeline drawer visualises every RAG step (extract → chunk → embed → store → retrieve → generate), and a toggle lets you compare answers with retrieval on vs. off.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · hand-authored shadcn/ui · Zod · AI SDK v6
**Supabase** (Google OAuth + Postgres, accessed via `@supabase/supabase-js` + RLS) · **Voyage AI** embeddings (`voyage-3-large`) · **Qdrant** vector store · **Anthropic Claude** (`claude-sonnet-4-6`) for generation.

## How it works

```
Ingest  (POST /api/documents, NDJSON stream)      Answer (POST /api/chat, UI message stream)
  1. Extract text   ExtractTextService              5. Retrieve   RetrievalService (Qdrant search)
  2. Chunk          ChunkingService                 6. Generate   ChatService (Claude, streamed)
  3. Embed          EmbeddingsService (Voyage)
  4. Store          StoreChunksService (Qdrant)
```

Chunks are stored in Qdrant tagged with their `conversationId`; retrieval filters on it so answers are grounded only in the current conversation's documents. Conversations and messages are persisted to Supabase Postgres (RLS-scoped to the signed-in user).

## Project structure

```
src/
  app/
    (auth)/                  # sign-in / sign-up / password reset
    (app)/                   # authed shell: /chat and /chat/[conversationId]
    api/                     # chat, conversations, conversations/[id], documents
    auth/callback            # OAuth code exchange
  components/
    layout/                  # appSidebar, userMenu (app chrome)
    ui/                      # hand-authored shadcn primitives (camelCase filenames)
  services/                  # business + RAG pipeline (one service per step) + supabase persistence
  views/                     # route-aligned feature modules
    chat/                    #   chatWindow, conversationSidebar, the RAG drawer + zustand store
    conversations/hooks/     #   useDocumentUpload (ingest stream reader)
    users/                   #   auth server actions + forms
  lib/supabase/              # browser / server clients
  types/                     # api envelope + UI DTOs
  utils/                     # cn, files, apiClient
  proxy.ts                   # Next 16 middleware: session refresh + route guard
supabase/schema.sql          # run by hand in the Supabase SQL Editor
```

> The feature folder is `views/`, not `pages/` — `pages` is a reserved Next.js directory (the legacy Pages Router). Conventions: **camelCase filenames**, feature folders named to match routes.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase, Qdrant, Voyage, and Anthropic values
npm run dev                  # or: npm run dev:proxy  (if you're behind a TLS-intercepting proxy)
```

Then, once per project:

1. **Database** — open the Supabase Dashboard → SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql) (creates `conversations` + `messages` with RLS).
2. **Auth** — enable the Google provider in Supabase (Authentication → Providers), set the OAuth client's redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`, and set the Site URL to `http://localhost:3000`.

The UI compiles and renders with placeholder env values; sign-in, retrieval and generation activate once real credentials are present.

## Environment

See [`.env.example`](.env.example). Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. Server-only secrets (never `NEXT_PUBLIC_`): `QDRANT_URL`, `QDRANT_API_KEY`, `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`.

## Scripts

`dev` · `dev:proxy` · `build` · `start` · `lint` · `typecheck`

There is no test suite — `npm run typecheck` and `npm run lint` are the correctness gates.

## Screenshots

### Dark theme

![Dark theme — conversation with the RAG pipeline drawer showing every step completed](docs/screenshots/dark-chat.png)

### Light theme

![Light theme — empty state with the pipeline drawer](docs/screenshots/light-empty.png)

![Light theme — conversation grounded in the uploaded document, pipeline steps complete](docs/screenshots/light-chat.png)
