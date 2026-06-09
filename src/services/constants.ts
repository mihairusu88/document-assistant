/** Shared constants for the RAG services. */

/** Target chunk size (characters) used when splitting extracted text. */
export const CHUNK_SIZE = 500;

/** Voyage AI embedding model. `voyage-3-large` produces 1024-dim vectors. */
export const EMBEDDING_MODEL = "voyage-3-large";

/** Output vector size for `voyage-3-large` (its default). */
export const EMBEDDING_DIMENSIONS = 1024;

/** Voyage AI embeddings REST endpoint (no Node SDK; called via fetch). */
export const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

/** Qdrant collection that stores document chunk vectors. */
export const QDRANT_COLLECTION = "documents";

/** How many of the nearest chunks to retrieve as context for a question. */
export const RETRIEVAL_TOP_K = 5;

/** Anthropic chat model used to generate answers from retrieved context. */
export const CHAT_MODEL = "claude-haiku-4-5";
