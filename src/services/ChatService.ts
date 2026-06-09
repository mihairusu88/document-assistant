import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  isTextUIPart,
  streamText,
  type StreamTextResult,
  type ToolSet,
  type UIMessage,
} from "ai";
import { CHAT_MODEL } from "@/services/constants";
import {
  buildSystemPrompt,
  PLAIN_SYSTEM_PROMPT,
  RETRIEVAL_UNAVAILABLE_PROMPT,
} from "@/services/prompts";
import { RetrievalService, type RetrievedChunk } from "@/services/RetrievalService";

/** Stream plus the inputs that produced it, so the route can report steps 5-6. */
export interface ChatStream {
  result: StreamTextResult<ToolSet, never>;
  chunks: RetrievedChunk[];
  /** The full system prompt sent to the LLM (with injected context, if any). */
  system: string;
  /** The chat model used for generation. */
  model: string;
  /** The user question used for retrieval / answered. */
  query: string;
  /**
   * Set when retrieval (step 5) failed but generation proceeded anyway — the
   * answer is produced without document context and the failure is surfaced in
   * the drawer instead of crashing the request.
   */
  retrievalError?: string;
}

/**
 * Step 6 of the RAG pipeline: generate an answer.
 * Retrieves the chunks relevant to the latest user question (RetrievalService),
 * injects them into the system prompt, and streams a completion from Claude.
 */
export class ChatService {
  private readonly retrieval: RetrievalService;

  constructor() {
    this.retrieval = new RetrievalService();
  }

  async streamAnswer({
    conversationId,
    messages,
    ragEnabled = true,
  }: {
    conversationId: string;
    messages: UIMessage[];
    /** When false, skip retrieval and answer from the model alone. */
    ragEnabled?: boolean;
  }): Promise<ChatStream> {
    const question = latestUserText(messages);

    let chunks: RetrievedChunk[] = [];
    let retrievalError: string | undefined;
    if (ragEnabled) {
      try {
        chunks = await this.retrieval.retrieve(question, conversationId);
      } catch (err) {
        // A retrieval failure (transient embeddings/Qdrant/proxy error) must not
        // crash the whole chat request. Degrade: answer without context and
        // report the failure so the drawer's Retrieve step shows it.
        retrievalError = err instanceof Error ? err.message : "Retrieval failed.";
        console.error("[ChatService] retrieval failed:", err);
      }
    }

    let system: string;
    if (!ragEnabled) {
      system = PLAIN_SYSTEM_PROMPT;
    } else if (retrievalError) {
      system = RETRIEVAL_UNAVAILABLE_PROMPT;
    } else {
      system = buildSystemPrompt(chunks);
    }

    const result = streamText({
      model: anthropic(CHAT_MODEL),
      system,
      messages: await convertToModelMessages(messages),
    });

    return { result, chunks, system, model: CHAT_MODEL, query: question, retrievalError };
  }
}

/** Extract the plain text of the most recent user message. */
function latestUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  return lastUser.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join(" ");
}
