/**
 * Prompts for the RAG chat. Kept in one place so the assistant's behaviour is
 * easy to tune without touching the service logic.
 */

/**
 * Plain assistant prompt used when the RAG system is toggled off, so the answer
 * comes from the model alone (no retrieved document context) — useful for
 * comparing responses with and without retrieval.
 */
export const PLAIN_SYSTEM_PROMPT = `You are a helpful assistant. Answer the user's questions directly and concisely using your own knowledge.`;

/**
 * Used when retrieval failed (e.g. a transient embeddings/Qdrant error) but we
 * still want to answer rather than crash the request — so the assistant is
 * honest that it couldn't reach the user's documents this time.
 */
export const RETRIEVAL_UNAVAILABLE_PROMPT = `You are a helpful assistant that answers questions about the user's uploaded documents.

Document retrieval is temporarily unavailable for this message, so you could not access the user's documents right now. Let the user know you couldn't reach their documents this time and suggest they try again in a moment. You may still help from general knowledge, but be clear about what you could not access.`;

/** Base instructions for the assistant. */
export const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about the user's uploaded documents.

Rules:
- Answer using ONLY the context provided below. Do not rely on outside knowledge.
- If the answer is not contained in the context, say you couldn't find it in the uploaded documents — do not guess.
- Be concise and quote concrete details (numbers, names, dates) from the context where relevant.`;

/** A single retrieved chunk used to build the context block. */
export interface ContextChunk {
  text: string;
  fileName: string;
}

/**
 * Build the full system prompt for a request by appending the retrieved
 * document context to {@link SYSTEM_PROMPT}.
 */
export function buildSystemPrompt(chunks: ContextChunk[]): string {
  const context =
    chunks.length === 0
      ? "(No relevant context was found in the uploaded documents.)"
      : chunks
          .map((c, i) => `[${i + 1}] (from ${c.fileName})\n${c.text}`)
          .join("\n\n");

  return `${SYSTEM_PROMPT}\n\n--- Context from the user's documents ---\n${context}`;
}
