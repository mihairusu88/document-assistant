import { getCurrentUser } from "@/lib/supabase/server";
import { ExtractTextService } from "@/services/ExtractTextService";
import { ChunkingService } from "@/services/ChunkingService";
import { EmbeddingsService } from "@/services/EmbeddingsService";
import { StoreChunksService } from "@/services/StoreChunksService";
import { EMBEDDING_MODEL } from "@/services/constants";
import { isAcceptedFile, MAX_DOCUMENT_SIZE_BYTES } from "@/utils/files";

/** Label describing the model used at a step (or that none is) — so the drawer
 * makes it obvious which steps hit a model/LLM and which are pure compute. */
const NO_MODEL = "none (no model used)";
const EMBED_MODEL_LABEL = `${EMBEDDING_MODEL} (embedding model)`;

// Node runtime: the extraction libraries (pdfreader/mammoth/word-extractor)
// rely on Node APIs and can't run on the Edge.
export const runtime = "nodejs";

/** One newline-delimited JSON event, as the client's stepper reader expects. */
function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/**
 * POST /api/documents — RAG steps 1-4, streamed.
 *
 * Validation/auth fail fast with a normal JSON error. On success the body is an
 * `application/x-ndjson` stream of per-step events so the chat drawer can show
 * each step go running -> success/error in real time:
 *   {"type":"step","id":1,"status":"running"}
 *   {"type":"step","id":1,"status":"success","data":{"charCount":1234}}
 *   {"type":"error","id":3,"message":"…"}   // a step threw
 *   {"type":"done"}
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("unauthorized", "Authentication required.", 401);

  const form = await req.formData();
  const file = form.get("file");
  const conversationId = form.get("conversationId");

  if (!(file instanceof File)) {
    return jsonError("validation_error", "A file is required.", 400);
  }
  if (typeof conversationId !== "string" || !conversationId) {
    return jsonError("validation_error", "A conversationId is required.", 400);
  }
  if (!isAcceptedFile(file.name, file.type)) {
    return jsonError(
      "validation_error",
      "Unsupported file type. Allowed: PDF, DOC, DOCX, Text.",
      400,
    );
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError("validation_error", "File exceeds the 10 MB limit.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(ndjson(obj));
      // Tracks which step is in flight so a thrown error names the right one.
      let step = 0;
      try {
        // Step 1: file -> text
        step = 1;
        emit({ type: "step", id: 1, status: "running" });
        const text = await new ExtractTextService().extractText({
          buffer,
          mimeType: file.type,
          fileName: file.name,
        });
        emit({
          type: "step",
          id: 1,
          status: "success",
          data: { charCount: text.length, model: NO_MODEL },
        });

        // Step 2: text -> chunks
        step = 2;
        emit({ type: "step", id: 2, status: "running" });
        const chunks = new ChunkingService().chunkText(text);
        emit({
          type: "step",
          id: 2,
          status: "success",
          data: {
            chunkCount: chunks.length,
            model: NO_MODEL,
            // One object per chunk so the drawer can expand the full split.
            preview: chunks.map((c, i) => ({
              index: i + 1,
              chunkId: c.chunkId,
              chars: c.text.length,
              text: c.text,
            })),
          },
        });

        // Step 3: chunks -> embeddings (aligned by index with `chunks`)
        step = 3;
        emit({ type: "step", id: 3, status: "running" });
        const embeddings = await new EmbeddingsService().embedText(chunks.map((c) => c.text));
        emit({
          type: "step",
          id: 3,
          status: "success",
          data: {
            count: embeddings.length,
            dims: embeddings[0]?.length ?? 0,
            model: EMBED_MODEL_LABEL,
            // Each chunk with the first few dims of its embedding vector.
            preview: chunks.map((c, i) => ({
              index: i + 1,
              chunkId: c.chunkId,
              chars: c.text.length,
              vector: (embeddings[i] ?? []).slice(0, 8).map((n) => Number(n.toFixed(5))),
              text: c.text,
            })),
          },
        });

        // Step 4: store chunk vectors in Qdrant (scoped to this conversation)
        step = 4;
        emit({ type: "step", id: 4, status: "running" });
        const stored = await new StoreChunksService().storeChunks({
          conversationId,
          fileName: file.name,
          chunks,
          embeddings,
        });
        emit({
          type: "step",
          id: 4,
          status: "success",
          data: {
            collection: stored.collection,
            stored: stored.stored,
            model: NO_MODEL,
            // Each stored Qdrant point with its chunk text + ids.
            preview: stored.points.map((p, i) => ({
              index: i + 1,
              pointId: p.pointId,
              chunkId: p.chunkId,
              fileName: file.name,
              chars: chunks[i]?.text.length ?? 0,
              text: chunks[i]?.text ?? "",
            })),
          },
        });

        emit({ type: "done", data: { fileName: file.name } });
      } catch (err) {
        console.error(`[api/documents] step ${step} failed:`, err);
        emit({
          type: "error",
          id: step,
          message: err instanceof Error ? err.message : "Failed to process file.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
