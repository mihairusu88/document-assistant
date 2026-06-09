/**
 * Shared model for the RAG pipeline status shown in the chat drawer.
 *
 * The pipeline spans two phases that run on different routes:
 *   - Ingest (steps 1-4) — POST /api/documents, on submit when a file is staged.
 *   - Answer (steps 5-6) — POST /api/chat, every time a question is sent.
 *
 * Status lives in the zustand store ({@link useRagStore}), keyed by conversation
 * id; the new-chat screen generates that id up front so its ingest progress
 * carries over to the thread, where the drawer also lives.
 */

export type RagStepStatus = "pending" | "running" | "success" | "error";

export interface RagStepState {
  status: RagStepStatus;
  /** The `[RAG] Step N - …` line, shown verbatim in the drawer's code block. */
  log: string;
  /** The raw structured per-step payload, shown as an expandable JSON tree. */
  data?: unknown;
}

export type RagState = Record<number, RagStepState>;

/** A patch applied to a single step by the ingest/answer reporters. */
export type RagReporter = (id: number, patch: Partial<RagStepState>) => void;

export interface RagStepDef {
  id: number;
  title: string;
}

/** One retrieved chunk, surfaced in the drawer's step 5/6 JSON preview. */
export interface RagChunkPreview {
  rank: number;
  score: number;
  fileName: string;
  chunkId: string;
  chars: number;
  text: string;
}

/**
 * Pipeline detail the chat route attaches to the assistant message as
 * `messageMetadata`, so the client can report steps 5-6 with real data:
 *  - `rag` — the retrieval (step 5) summary; omitted entirely when RAG is off.
 *  - `generate` — the generation (step 6) inputs, including the full prompt
 *    actually sent to the LLM; always present, so the prompt is visible whether
 *    RAG is on or off (for comparison).
 */
export interface RagMessageMetadata {
  rag?: {
    retrievedCount: number;
    topScore: number | null;
    fileNames: string[];
    /** Embedding model used to vectorise the query (step 5). */
    queryModel?: string;
    /** The question that was embedded + searched. */
    query?: string;
    /** The retrieved chunks themselves, for the expandable JSON preview. */
    preview?: RagChunkPreview[];
    /** Set when retrieval failed; the answer was generated without context. */
    error?: string;
  };
  generate?: {
    /** The LLM used to generate the answer (step 6). */
    model: string;
    ragEnabled: boolean;
    /** The full system prompt sent to the LLM (with injected context, if any). */
    systemPrompt: string;
    /** The conversation turns sent to the LLM, as role + flattened text. */
    messages: { role: string; text: string }[];
  };
}

export const RAG_STEPS: readonly RagStepDef[] = [
  { id: 1, title: "Extract text" },
  { id: 2, title: "Chunking" },
  { id: 3, title: "Embeddings" },
  { id: 4, title: "Store in Vector DB" },
  { id: 5, title: "Retrieve" },
  { id: 6, title: "Generate" },
] as const;

/** The step ids that make up the ingest phase (POST /api/documents). */
export const INGEST_STEP_IDS = [1, 2, 3, 4] as const;
/** The step ids that make up the answer phase (POST /api/chat). */
export const ANSWER_STEP_IDS = [5, 6] as const;

export function ragStepTitle(id: number): string {
  return RAG_STEPS.find((s) => s.id === id)?.title ?? `Step ${id}`;
}

export function initialRagState(): RagState {
  const state: RagState = {};
  for (const step of RAG_STEPS) {
    state[step.id] = { status: "pending", log: "" };
  }
  return state;
}
