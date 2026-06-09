import { CHUNK_SIZE } from "@/services/constants";

/** A single chunk of document text. */
export interface Chunk {
  chunkId: string;
  text: string;
}

/**
 * Step 2 of the RAG pipeline: split extracted text into chunks.
 */
export class ChunkingService {
  /**
   * Split `text` into chunks of about `chunkSize` characters. Whitespace is
   * collapsed first, and chunks break on word boundaries where possible so
   * words aren't split across chunks.
   *
   * @param text       The full extracted document text.
   * @param chunkSize  Target chunk length in characters (default {@link CHUNK_SIZE}).
   * @returns          e.g. `[{ chunkId: "1", text: "Bla Bla Bla" }]`
   */
  chunkText(text: string, chunkSize: number = CHUNK_SIZE): Chunk[] {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return [];

    const chunks: Chunk[] = [];
    let start = 0;
    let id = 1;

    while (start < clean.length) {
      let end = Math.min(start + chunkSize, clean.length);

      // Prefer breaking on the last space inside the window (avoid cutting a word).
      if (end < clean.length) {
        const lastSpace = clean.lastIndexOf(" ", end);
        if (lastSpace > start) end = lastSpace;
      }

      const piece = clean.slice(start, end).trim();
      if (piece) chunks.push({ chunkId: String(id++), text: piece });

      start = end;
    }

    return chunks;
  }
}
