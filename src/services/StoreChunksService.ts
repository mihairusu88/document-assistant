import { randomUUID } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import {
  EMBEDDING_DIMENSIONS,
  QDRANT_COLLECTION,
} from "@/services/constants";
import type { Chunk } from "@/services/ChunkingService";

/** Outcome of a store operation. */
export interface StoreResult {
  collection: string;
  stored: number;
  /** The upserted points, aligned by index with the input chunks. */
  points: { pointId: string; chunkId: string }[];
}

/** Inputs to {@link StoreChunksService.storeChunks}. */
export interface StoreChunksInput {
  /** Scopes the stored chunks so retrieval only sees this conversation's docs. */
  conversationId: string;
  fileName: string;
  chunks: Chunk[];
  /** One embedding vector per chunk, aligned by index. */
  embeddings: number[][];
}

/**
 * Step 4 of the RAG pipeline: store chunk vectors in Qdrant.
 * Runs server-side — the cluster URL + API key are secrets.
 *
 * Ensures the collection exists (created lazily with the embedding model's
 * vector size + cosine distance), then upserts one point per chunk with the
 * chunk text kept in the payload so it can be returned at query time.
 */
export class StoreChunksService {
  private readonly client: QdrantClient;

  constructor() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) {
      throw new Error("QDRANT_URL is not set. Add it to .env.local (see .env.example).");
    }
    if (!apiKey) {
      throw new Error("QDRANT_API_KEY is not set. Add it to .env.local (see .env.example).");
    }
    // port: null -> use the URL's own port (Qdrant Cloud serves REST on 443),
    // otherwise the client forces :6333.
    this.client = new QdrantClient({ url, apiKey, port: null });
  }

  async storeChunks({ conversationId, fileName, chunks, embeddings }: StoreChunksInput): Promise<StoreResult> {
    if (chunks.length !== embeddings.length) {
      throw new Error(
        `chunks/embeddings length mismatch: ${chunks.length} vs ${embeddings.length}.`,
      );
    }

    await this.ensureCollection();

    const points = chunks.map((chunk, i) => ({
      id: randomUUID(),
      vector: embeddings[i],
      payload: { conversationId, chunkId: chunk.chunkId, text: chunk.text, fileName },
    }));

    if (points.length > 0) {
      await this.client.upsert(QDRANT_COLLECTION, { wait: true, points });
    }

    return {
      collection: QDRANT_COLLECTION,
      stored: points.length,
      points: points.map((p) => ({
        pointId: String(p.id),
        chunkId: String(p.payload.chunkId),
      })),
    };
  }

  /** Create the collection on first use, sized for the current embedding model. */
  private async ensureCollection(): Promise<void> {
    const { exists } = await this.client.collectionExists(QDRANT_COLLECTION);
    if (!exists) {
      await this.client.createCollection(QDRANT_COLLECTION, {
        vectors: { size: EMBEDDING_DIMENSIONS, distance: "Cosine" },
      });
    }

    // Index on conversationId is required for retrieval's filter. Idempotent —
    // Qdrant no-ops if it already exists, so this also heals older collections.
    await this.client.createPayloadIndex(QDRANT_COLLECTION, {
      field_name: "conversationId",
      field_schema: "keyword",
      wait: true,
    });
  }
}
