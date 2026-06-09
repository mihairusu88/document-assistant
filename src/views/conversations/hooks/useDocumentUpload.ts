"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isAcceptedFile, MAX_DOCUMENT_SIZE_BYTES } from "@/utils/files";
import { ragStepTitle, type RagReporter } from "@/views/chat/rag/ragSteps";

/** A single step event from the streamed POST /api/documents response. */
type StepEvent =
  | { type: "step"; id: number; status: "running" | "success"; data?: Record<string, unknown> }
  | { type: "error"; id: number; message: string }
  | { type: "done"; data?: { fileName: string } };

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Build the `[RAG] Step N - …` line for a finished ingest step. This is the
 * single source of truth for both the console log and the drawer's code block,
 * so the two always read identically.
 */
function formatStepLog(id: number, data: Record<string, unknown> = {}): string {
  switch (id) {
    case 1:
      return `[RAG] Step 1 - Extract text: extracted ${num(data.charCount)} characters`;
    case 2: {
      const first = Array.isArray(data.preview)
        ? str((data.preview[0] as { text?: unknown } | undefined)?.text)
        : str(data.preview);
      const oneLine = first.replace(/\s+/g, " ").trim();
      const snippet = oneLine.slice(0, 180);
      const ellipsis = oneLine.length > 180 ? "…" : "";
      const tail = snippet ? `\n  ↳ chunk[1]: "${snippet}${ellipsis}"` : "";
      return `[RAG] Step 2 - Chunking: split into ${num(data.chunkCount)} chunks${tail}`;
    }
    case 3:
      return `[RAG] Step 3 - Embeddings: ${num(data.count)} vectors × ${num(data.dims)} dims (voyage-3-large)`;
    case 4:
      return `[RAG] Step 4 - Store in Vector DB: upserted ${num(data.stored)} vectors into collection "${str(data.collection)}"`;
    default:
      return `[RAG] Step ${id}`;
  }
}

/**
 * RAG steps 1-4 (client side): runs at submit time (not on attach, to avoid
 * bloating Qdrant with files the user never asks about). The server streams a
 * per-step event for each stage; we format + log it and forward the status to
 * the drawer via `report`. Throws on failure so the caller can abort the send.
 */
export function useDocumentUpload() {
  const [ingesting, setIngesting] = useState(false);

  async function ingest(
    file: File,
    conversationId: string,
    report?: RagReporter,
  ): Promise<void> {
    if (!isAcceptedFile(file.name, file.type)) {
      throw new Error("Unsupported file type. Allowed: PDF, DOC, DOCX, Text.");
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error("File exceeds the 10 MB limit.");
    }

    setIngesting(true);
    const toastId = toast.loading(`Processing ${file.name}…`);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("conversationId", conversationId);

      const res = await fetch("/api/documents", { method: "POST", body });

      // Auth/validation fail before the stream starts — a plain JSON error.
      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? `Upload failed (${res.status}).`);
      }

      let stored = 0;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Read newline-delimited JSON events, dispatching each as it arrives.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          const evt = JSON.parse(line) as StepEvent;

          if (evt.type === "step" && evt.status === "running") {
            report?.(evt.id, { status: "running" });
          } else if (evt.type === "step" && evt.status === "success") {
            const log = formatStepLog(evt.id, evt.data);
            console.log(log, evt.data ?? {});
            report?.(evt.id, { status: "success", log, data: evt.data });
            if (evt.id === 4) stored = Number(evt.data?.stored ?? 0);
          } else if (evt.type === "error") {
            const label = `Step ${evt.id}: ${ragStepTitle(evt.id)} — failed`;
            console.error(`[RAG] ${label}`, evt.message);
            report?.(evt.id, {
              status: "error",
              log: `[RAG] ${label}\n  ↳ ${evt.message}`,
              data: { error: evt.message },
            });
            toast.error(`${label}: ${evt.message}`, { id: toastId });
            throw new Error(label);
          }
        }
      }

      toast.success(`Added ${file.name} (${stored} chunks).`, { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add document.";
      // Step errors already raised their own toast above; only surface others.
      if (message.startsWith("Step ")) toast.dismiss(toastId);
      else toast.error(message, { id: toastId });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIngesting(false);
    }
  }

  return { ingesting, ingest };
}
