import { isTextUIPart, type UIMessage } from "ai";
import { getCurrentUser } from "@/lib/supabase/server";
import { ChatService } from "@/services/ChatService";
import { ConversationService } from "@/services/ConversationService";
import { MessageService } from "@/services/MessageService";
import { EMBEDDING_MODEL } from "@/services/constants";

/** Flatten a UI message to `{ role, text }` for the prompt preview. */
function toPromptMessage(m: UIMessage): { role: string; text: string } {
  return {
    role: m.role,
    text: m.parts
      .filter(isTextUIPart)
      .map((p) => p.text)
      .join("\n"),
  };
}

// Node runtime: retrieval/embeddings call out to Voyage + Qdrant over the
// corporate proxy, which needs Node's TLS (NODE_EXTRA_CA_CERTS / dev:proxy).
export const runtime = "nodejs";

/** Derive a conversation title from the first user message (truncated). */
function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join(" ")
    .trim();
  if (!text) return "New chat";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/**
 * POST /api/chat — RAG steps 5 + 6, plus persistence.
 * Ensures the conversation exists, saves the incoming user message(s), retrieves
 * context (unless RAG is disabled) and streams Claude's answer; the assistant
 * message is persisted on finish. Not wrapped in `withApiHandler` (it streams).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Authentication required.", { status: 401 });
  }

  const { id, messages, ragEnabled = true } = (await req.json()) as {
    id: string;
    messages: UIMessage[];
    ragEnabled?: boolean;
  };

  const conversations = new ConversationService();
  const messageStore = new MessageService();

  // Persist the conversation + the user's messages before streaming.
  // Best-effort: a persistence failure (e.g. before the schema migration is
  // applied) must not stop the user from chatting.
  try {
    await conversations.ensure({ id, title: deriveTitle(messages) });
    await messageStore.saveUIMessages(id, messages);
  } catch (err) {
    console.error("[api/chat] could not persist user messages:", err);
  }

  const { result, chunks, system, model, query, retrievalError } =
    await new ChatService().streamAnswer({
      conversationId: id,
      messages,
      ragEnabled,
    });

  const promptMessages = messages.map(toPromptMessage);

  return result.toUIMessageStreamResponse({
    // Persistence mode: give the assistant message a stable, unique id so it can
    // be saved (and reloaded) reliably. Without this the response message has no
    // id, so successive replies collide and get dropped on the upsert.
    originalMessages: messages,
    generateMessageId: () => crypto.randomUUID(),
    // Surface the pipeline detail (steps 5-6) on the assistant message so the
    // drawer can show retrieval results AND the exact prompt sent to the LLM.
    // `rag` is omitted when RAG is off; `generate` is always present so the
    // prompt is visible either way (for comparison).
    messageMetadata: ({ part }) =>
      part.type === "start"
        ? {
            rag: ragEnabled
              ? {
                  retrievedCount: chunks.length,
                  topScore: chunks[0]?.score ?? null,
                  fileNames: [...new Set(chunks.map((c) => c.fileName))],
                  queryModel: `${EMBEDDING_MODEL} (embedding model)`,
                  query,
                  // The retrieved chunks themselves, for the drawer's JSON preview.
                  preview: chunks.map((c, i) => ({
                    rank: i + 1,
                    score: Number(c.score.toFixed(4)),
                    fileName: c.fileName,
                    chunkId: c.chunkId,
                    chars: c.text.length,
                    text: c.text,
                  })),
                  // Set when retrieval failed but we still answered (no context).
                  error: retrievalError,
                }
              : undefined,
            generate: {
              model: `${model} (LLM)`,
              ragEnabled,
              systemPrompt: system,
              messages: promptMessages,
            },
          }
        : undefined,
    onFinish: async ({ responseMessage }) => {
      // Persist the assistant's reply and bump the conversation's updated_at.
      try {
        await messageStore.saveUIMessages(id, [responseMessage]);
        await conversations.touch(id);
      } catch (err) {
        console.error("[api/chat] could not persist assistant reply:", err);
      }
    },
    onError: (error) =>
      error instanceof Error ? error.message : "Failed to generate a reply.",
  });
}
