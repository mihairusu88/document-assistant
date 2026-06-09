"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme/themeToggle";
import { apiFetch } from "@/utils/apiClient";
import { useDocumentUpload } from "@/views/conversations/hooks/useDocumentUpload";
import { useRagStatus } from "@/views/chat/rag/useRagStatus";
import { ComposerAttachMenu } from "./composerAttachMenu";
import { ComposerAttachment } from "./composerAttachment";
import { RagDrawer, RagDrawerToggle, RagSwitch } from "./ragDrawer";

/**
 * Empty-state composer shown at /chat. The conversation id is generated up front
 * so the RAG drawer is live here too: a staged file is ingested into Qdrant
 * under that id (steps 1-4), then we navigate to the thread — which reads the
 * same id from the store and runs steps 5-6 against the auto-sent draft.
 */
export function NewChatPrompt() {
  const router = useRouter();
  const { ingesting, ingest } = useDocumentUpload();
  // Stable id for this not-yet-created conversation (used by the store + URL).
  const [conversationId] = useState(() => crypto.randomUUID());
  const { state, open, setOpen, toggleOpen, setStep, resetIngest } =
    useRagStatus(conversationId);
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);

    try {
      // RAG steps 1-4 run here, on submit — not when the file was attached.
      // The store keeps the progress under this conversation id, so the thread
      // we navigate to picks up the completed steps.
      if (staged) {
        resetIngest();
        setOpen(true);
        await ingest(staged, conversationId, setStep);
      }
      // Create the conversation row up front so it appears in the sidebar with
      // a real title. Best-effort — chat still works if persistence is down.
      try {
        await apiFetch("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ id: conversationId, title: text }),
        });
      } catch (err) {
        console.warn("[chat] could not create conversation:", err);
      }
      const params = new URLSearchParams({ draft: text });
      router.push(`/chat/${conversationId}?${params.toString()}`);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="z-30 flex shrink-0 items-center justify-end gap-1 border-b bg-background px-4 py-2">
        <RagSwitch />
        <RagDrawerToggle open={open} onToggle={toggleOpen} />
        <ThemeToggle />
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="size-6" />
            </span>
            <h1 className="text-2xl font-semibold">How can I help?</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Attach a document with + , then ask a question about it.
            </p>
          </div>
          <div className="w-full max-w-2xl">
            <div className="rounded-2xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
              {staged ? (
                <ComposerAttachment
                  file={staged}
                  busy={ingesting}
                  onRemove={() => setStaged(null)}
                />
              ) : null}
              <div className="flex items-end gap-2">
                <ComposerAttachMenu
                  uploading={ingesting}
                  disabled={busy}
                  onFile={(file) => setStaged(file)}
                />
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void start();
                    }
                  }}
                  placeholder="Ask about your documents…"
                  rows={1}
                  className="max-h-40 min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  autoFocus
                />
                <Button size="icon" onClick={() => void start()} disabled={!input.trim() || busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <RagDrawer open={open} onClose={() => setOpen(false)} state={state} />
      </div>
    </div>
  );
}
