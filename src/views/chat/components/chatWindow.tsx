"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { ArrowUp, CircleAlertIcon, Square } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scrollArea";
import { ThemeToggle } from "@/components/theme/themeToggle";
import { CHAT_MODEL } from "@/services/constants";
import { useDocumentUpload } from "@/views/conversations/hooks/useDocumentUpload";
import { useRagStatus } from "@/views/chat/rag/useRagStatus";
import { useRagStore } from "@/views/chat/rag/ragStore";
import {
  ANSWER_STEP_IDS,
  INGEST_STEP_IDS,
  ragStepTitle,
  type RagMessageMetadata,
} from "@/views/chat/rag/ragSteps";
import type { DocumentDTO } from "@/types/entities";
import { MessageBubble } from "./messageBubble";
import { ComposerAttachMenu } from "./composerAttachMenu";
import { ComposerAttachment } from "./composerAttachment";
import { DocumentChips } from "./documentChips";
import { RagDrawer, RagDrawerToggle, RagSwitch } from "./ragDrawer";

/** Total length of an assistant message's text parts, for the step-6 log. */
function textLength(message: UIMessage): number {
  return message.parts
    .filter(isTextUIPart)
    .reduce((n, part) => n + part.text.length, 0);
}

/** Build the `[RAG] Step 5 - Retrieve` line from the assistant's metadata. */
function retrieveLog(rag: NonNullable<RagMessageMetadata["rag"]>): string {
  if (rag.error) {
    return `[RAG] Step 5 - Retrieve — failed (answered without context)\n  ↳ ${rag.error}`;
  }
  if (rag.retrievedCount === 0) {
    return "[RAG] Step 5 - Retrieve: no matching chunks (upload a document, then ask)";
  }
  const files = rag.fileNames.filter(Boolean);
  const from = files.length > 0 ? ` from ${files.join(", ")}` : "";
  const score = rag.topScore == null ? "" : ` (top score ${rag.topScore.toFixed(3)})`;
  return `[RAG] Step 5 - Retrieve: ${rag.retrievedCount} chunk(s)${from}${score}`;
}

export function ChatWindow({
  conversationId,
  initialMessages,
  initialDraft,
  documents,
}: Readonly<{
  conversationId: string;
  initialMessages: UIMessage[];
  initialDraft?: string;
  documents: DocumentDTO[];
}>) {
  const { state, open, setOpen, toggleOpen, setStep, resetIngest, resetAnswer } =
    useRagStatus(conversationId);
  const ragEnabled = useRagStore((s) => s.ragEnabled);

  // Stable transport; the `ragEnabled` flag is sent per-request via
  // sendMessage's body (the server skips retrieval when it's off).
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      finishedFor.current = message.id;
      // The stream can both error and "finish" (with empty text); onError owns
      // the failure, so don't overwrite its red step with a green one.
      if (failedAnswer.current) return;
      // Fallback: a very short answer can finish before the metadata effect
      // runs — report step 5 here if it hasn't been reported yet.
      const meta = (message as { metadata?: RagMessageMetadata }).metadata;
      const rag = meta?.rag;
      const gen = meta?.generate;
      if (rag && retrievedFor.current !== message.id) {
        retrievedFor.current = message.id;
        const log5 = retrieveLog(rag);
        if (rag.error) console.error(log5);
        else console.log(log5);
        setStep(5, {
          status: rag.error ? "error" : "success",
          log: log5,
          data: rag,
        });
      }
      const chars = textLength(message);
      const log = `[RAG] Step 6 - Generate: streamed ${chars} chars from ${CHAT_MODEL}`;
      console.log(log);
      const enabled = gen?.ragEnabled ?? useRagStore.getState().ragEnabled;
      setStep(6, {
        status: "success",
        log,
        data: {
          chars,
          model: gen?.model ?? `${CHAT_MODEL} (LLM)`,
          ragEnabled: enabled,
          // The chunks fed to the model as context (empty when RAG is off).
          contextCount: rag?.preview?.length ?? 0,
          // The full prompt actually sent to the LLM at this step.
          prompt: gen
            ? { system: gen.systemPrompt, messages: gen.messages }
            : undefined,
          preview: rag?.preview ?? [],
        },
      });
    },
    onError: (err) => {
      failedAnswer.current = true;
      // Whichever answer step is mid-flight (5 then 6) is the one that failed.
      const steps = useRagStore.getState().byConversation[conversationId];
      const id = ANSWER_STEP_IDS.find((n) => steps?.[n]?.status === "running") ?? 6;
      const title = ragStepTitle(id);
      console.error(`[RAG] Step ${id}: ${title} — failed`, err);
      setStep(id, {
        status: "error",
        log: `[RAG] Step ${id}: ${title} — failed\n  ↳ ${err.message}`,
      });
      toast.error(`Step ${id}: ${title} — failed`);
    },
  });

  const { ingesting, ingest } = useDocumentUpload();
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<File | null>(null);
  // Bumped each time a question kicks off a pipeline run, so the drawer can
  // scroll back to step 1 and show the run "from the start".
  const [runId, setRunId] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftSent = useRef(false);
  // Assistant message whose retrieval metadata (step 5) we've already logged.
  const retrievedFor = useRef<string | null>(null);
  // Assistant message whose generation (step 6) has finished — guards the
  // metadata effect from regressing step 6 to "running" after a fast answer.
  const finishedFor = useRef<string | null>(null);
  // Set when the current answer errors, so a trailing onFinish can't paint the
  // failed step green.
  const failedAnswer = useRef(false);
  const busy = status === "submitted" || status === "streaming" || ingesting;

  // Ingest (steps 1-4) only runs on a fresh upload. When a question carries no
  // new document, those steps can't run again (the file isn't retained and its
  // chunks already live in Qdrant), so give them a coherent terminal state
  // instead of leaving them dangling at "pending" — which made the pipeline look
  // like it "started at step 5". Only fills steps still pending, so a real
  // ingest's captured per-step data (this turn or carried over) is never lost.
  function reflectIngest() {
    const steps = useRagStore.getState().byConversation[conversationId];
    const hasDocs = documents.length > 0;
    for (const id of INGEST_STEP_IDS) {
      if (steps?.[id]?.status === "success") continue;
      const title = ragStepTitle(id);
      if (hasDocs) {
        setStep(id, {
          status: "success",
          log: `[RAG] Step ${id} - ${title}: reused ${documents.length} already-ingested document(s)`,
          data: { reused: true, documentCount: documents.length },
        });
      } else {
        setStep(id, {
          status: "success",
          log: `[RAG] Step ${id} - ${title}: skipped (no document uploaded yet)`,
          data: { skipped: true, reason: "no document uploaded yet" },
        });
      }
    }
  }

  // Reset the answer steps and reveal the drawer. With RAG on, Retrieve starts
  // running; with RAG off, retrieval is skipped and we jump straight to Generate.
  function beginAnswer() {
    failedAnswer.current = false;
    resetAnswer();
    // Settle the ingest steps so the drawer shows the full pipeline coherently.
    reflectIngest();
    // New run: tell the drawer to scroll back to step 1 so the pipeline is shown
    // from the start (the retrieved context changes with each question).
    setRunId((n) => n + 1);
    if (ragEnabled) {
      setStep(5, { status: "running" });
    } else {
      const log = "[RAG] Step 5 - Retrieve: skipped (RAG disabled)";
      console.log(log);
      setStep(5, {
        status: "success",
        log,
        data: { skipped: true, reason: "RAG disabled", model: "none (retrieval skipped)" },
      });
      setStep(6, { status: "running" });
    }
    setOpen(true);
  }

  // Auto-send the draft carried over from the new-chat prompt (once). Steps 1-4
  // already ran there (persisted to sessionStorage and rehydrated above).
  useEffect(() => {
    if (initialDraft && !draftSent.current && messages.length === 0) {
      draftSent.current = true;
      beginAnswer();
      void sendMessage({ text: initialDraft }, { body: { ragEnabled } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft, messages.length, sendMessage]);

  // When the assistant message gains its retrieval metadata, report step 5
  // (Retrieve) done and step 6 (Generate) running — mid-stream, before onFinish.
  useEffect(() => {
    const assistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!assistant || retrievedFor.current === assistant.id) return;
    const rag = (assistant as { metadata?: RagMessageMetadata }).metadata?.rag;
    if (!rag) return;

    retrievedFor.current = assistant.id;
    const log = retrieveLog(rag);
    if (rag.error) console.error(log);
    else console.log(log);
    setStep(5, {
      status: rag.error ? "error" : "success",
      log,
      data: rag,
    });
    // Only advance step 6 to running if this answer hasn't already finished.
    if (finishedFor.current !== assistant.id) setStep(6, { status: "running" });
  }, [messages, setStep]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;

    // RAG steps 1-4 run here, on submit, so a staged-but-unused file never
    // reaches Qdrant. Abort the send if ingestion fails.
    if (staged) {
      resetIngest();
      setOpen(true);
      try {
        await ingest(staged, conversationId, setStep);
        setStaged(null);
      } catch {
        return;
      }
    }

    setInput("");
    beginAnswer();
    void sendMessage({ text }, { body: { ragEnabled } });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header sits above the drawer, so the toggle is always visible. */}
      <div className="z-30 flex shrink-0 items-center justify-end gap-1 border-b bg-background px-4 py-2">
        <RagSwitch />
        <RagDrawerToggle open={open} onToggle={toggleOpen} />
        <ThemeToggle />
      </div>

      {/* Body: chat column + resizable pipeline drawer that pushes the chat
          to the left rather than overlaying it. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {error ? (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t bg-background">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <DocumentChips documents={documents} />
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
                onFile={(file) => setStaged(file)}
              />
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Ask about your documents…"
                rows={1}
                className="max-h-40 min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              {busy ? (
                <Button size="icon" variant="secondary" onClick={() => stop()}>
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button size="icon" onClick={() => void submit()} disabled={!input.trim()}>
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Attach a document with + , then ask about it.
          </p>
        </div>
      </div>
        </div>

        <RagDrawer open={open} onClose={() => setOpen(false)} state={state} runId={runId} />
      </div>
    </div>
  );
}
