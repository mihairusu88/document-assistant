import { QdrantClient } from "@qdrant/js-client-rest";
import { EmbeddingsService } from "@/services/EmbeddingsService";
import { QDRANT_COLLECTION, RETRIEVAL_TOP_K } from "@/services/constants";

/** A chunk returned from a similarity search, with its relevance score. */
export interface RetrievedChunk {
  chunkId: string;
  text: string;
  fileName: string;
  score: number;
}

/**
 * Step 5 of the RAG pipeline: retrieve the chunks most relevant to a question.
 * Runs server-side. Embeds the query (Voyage, "query" mode) and runs a vector
 * search in Qdrant, scoped to the current conversation so answers only draw on
 * that conversation's documents.
 */
export class RetrievalService {
  private readonly client: QdrantClient;
  private readonly embeddings: EmbeddingsService;

  constructor() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) {
      throw new Error("QDRANT_URL is not set. Add it to .env.local (see .env.example).");
    }
    if (!apiKey) {
      throw new Error("QDRANT_API_KEY is not set. Add it to .env.local (see .env.example).");
    }
    this.client = new QdrantClient({ url, apiKey, port: null });
    this.embeddings = new EmbeddingsService();
  }

  async retrieve(
    query: string,
    conversationId: string,
    topK: number = RETRIEVAL_TOP_K,
  ): Promise<RetrievedChunk[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Nothing has been ingested yet — avoid a 404 on a missing collection.
    const { exists } = await this.client.collectionExists(QDRANT_COLLECTION);
    if (!exists) return [];

    const [vector] = await this.embeddings.embedText([trimmed], "query");

    const results = await this.client.search(QDRANT_COLLECTION, {
      vector,
      limit: topK,
      with_payload: true,
      filter: {
        must: [{ key: "conversationId", match: { value: conversationId } }],
      },
    });

    return results.map((r) => {
      const payload = r.payload ?? {};
      return {
        chunkId: String(payload.chunkId ?? ""),
        text: String(payload.text ?? ""),
        fileName: String(payload.fileName ?? ""),
        score: r.score,
      };
    });
  }
}
