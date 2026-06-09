"use client";

import { useCallback, useEffect, useRef } from "react";
import { Check, Loader2, PanelRightClose, Sparkles, Workflow, X } from "lucide-react";
import { useTheme } from "next-themes";
import {
  JsonView,
  defaultStyles,
  darkStyles,
  collapseAllNested,
} from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scrollArea";
import { Switch } from "@/components/ui/switch";
import { useRagStore } from "@/views/chat/rag/ragStore";
import { RAG_STEPS, type RagState, type RagStepStatus } from "@/views/chat/rag/ragSteps";

/** Drawer width bounds (px). */
const MIN_WIDTH = 360;
const MAX_WIDTH = 900;

/** Header control that enables/disables the RAG system (answers with vs.
 * without retrieved document context). Shown alongside the drawer toggle. */
export function RagSwitch() {
  const ragEnabled = useRagStore((s) => s.ragEnabled);
  const setRagEnabled = useRagStore((s) => s.setRagEnabled);
  return (
    <div
      className="mr-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"
      title={
        ragEnabled
          ? "RAG enabled — answers use your documents"
          : "RAG disabled — answers from the model only"
      }
    >
      <Sparkles className={ragEnabled ? "size-3.5 text-primary" : "size-3.5"} />
      <span>RAG</span>
      <Switch
        checked={ragEnabled}
        onCheckedChange={setRagEnabled}
        aria-label="Toggle RAG system"
      />
    </div>
  );
}

/** Header toggle that opens/closes the pipeline drawer. */
export function RagDrawerToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={open ? "secondary" : "ghost"}
      onClick={onToggle}
      aria-label="Toggle RAG pipeline"
      aria-pressed={open}
      title="RAG pipeline"
    >
      <Workflow className="size-4" />
    </Button>
  );
}

/**
 * Right-side drawer with a vertical stepper mirroring the RAG pipeline.
 * Sits in normal flow (a flex sibling of the chat column) so opening it pushes
 * the chat to the left rather than overlaying it, and its left edge is a
 * draggable handle that resizes the drawer (width persisted in the store).
 * Each step shows a status icon and an expandable JSON tree of its payload.
 */
export function RagDrawer({
  open,
  onClose,
  state,
  runId,
}: {
  open: boolean;
  onClose: () => void;
  state: RagState;
  /** Bumped when a new pipeline run starts; scrolls the list back to step 1. */
  runId?: number;
}) {
  const { resolvedTheme } = useTheme();
  const jsonStyle = resolvedTheme === "dark" ? darkStyles : defaultStyles;
  const width = useRagStore((s) => s.ragWidth);
  const setWidth = useRagStore((s) => s.setRagWidth);
  const topRef = useRef<HTMLDivElement>(null);

  // On each new run, scroll the pipeline back to the top so it reads "from the
  // start" rather than wherever the previous run left the viewport scrolled.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [runId]);

  // Drag the handle to resize. Listeners live for the duration of the drag,
  // attached to the document so the pointer can leave the thin handle.
  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = useRagStore.getState().ragWidth;

      const onMove = (ev: PointerEvent) => {
        const max = Math.min(MAX_WIDTH, globalThis.innerWidth - 360);
        const next = Math.min(
          Math.max(MIN_WIDTH, startWidth + (startX - ev.clientX)),
          Math.max(MIN_WIDTH, max),
        );
        setWidth(next);
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [setWidth],
  );

  if (!open) return null;

  return (
    <div className="flex h-full shrink-0" style={{ width }}>
      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize pipeline drawer"
        onPointerDown={startResize}
        className="group relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/60 transition-colors hover:bg-primary/40"
      >
        <span className="h-10 w-0.5 rounded-full bg-muted-foreground/40 group-hover:bg-primary" />
      </div>

      <aside className="flex h-full min-w-0 flex-1 flex-col bg-background">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">RAG pipeline</h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close pipeline"
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div ref={topRef} />
          <ol className="flex flex-col px-4 py-4">
            {RAG_STEPS.map((step, i) => (
              <StepRow
                key={step.id}
                index={step.id}
                title={step.title}
                status={state[step.id]?.status ?? "pending"}
                log={state[step.id]?.log ?? ""}
                data={state[step.id]?.data}
                jsonStyle={jsonStyle}
                last={i === RAG_STEPS.length - 1}
              />
            ))}
          </ol>
        </ScrollArea>
      </aside>
    </div>
  );
}

function StepRow({
  index,
  title,
  status,
  log,
  data,
  jsonStyle,
  last,
}: {
  index: number;
  title: string;
  status: RagStepStatus;
  log: string;
  data?: unknown;
  jsonStyle: typeof defaultStyles;
  last: boolean;
}) {
  return (
    <li className="flex gap-3">
      {/* Marker + connector line */}
      <div className="flex flex-col items-center">
        <StepMarker index={index} status={status} />
        {last ? null : (
          <span
            className={cn(
              "w-px flex-1",
              status === "success" ? "bg-emerald-500/50" : "bg-border",
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-5")}>
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium",
              status === "pending" && "text-muted-foreground",
              status === "success" && "text-emerald-600 dark:text-emerald-400",
              status === "error" && "text-red-600 dark:text-red-400",
            )}
          >
            {title}
          </p>
          <StatusLabel status={status} />
        </div>
        {data !== undefined ? (
          <div className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 text-[11px]">
            <JsonView
              data={data as object}
              shouldExpandNode={collapseAllNested}
              style={jsonStyle}
            />
          </div>
        ) : log ? (
          <pre className="mt-2 max-w-full whitespace-pre-wrap wrap-break-word rounded-md bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <code>{log}</code>
          </pre>
        ) : null}
      </div>
    </li>
  );
}

function StepMarker({ index, status }: { index: number; status: RagStepStatus }) {
  const base =
    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors";

  if (status === "running") {
    return (
      <span className={cn(base, "border-foreground bg-foreground text-background")}>
        <Loader2 className="size-4 animate-spin" />
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className={cn(base, "border-emerald-500 bg-emerald-500 text-white")}>
        <Check className="size-4" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cn(base, "border-red-500 bg-red-500 text-white")}>
        <X className="size-4" />
      </span>
    );
  }
  return (
    <span className={cn(base, "border-border bg-muted/40 text-muted-foreground")}>
      {index}
    </span>
  );
}

function StatusLabel({ status }: { status: RagStepStatus }) {
  const map: Record<RagStepStatus, { text: string; className: string }> = {
    pending: { text: "Pending", className: "text-muted-foreground" },
    running: { text: "Running", className: "text-foreground" },
    success: { text: "Done", className: "text-emerald-600 dark:text-emerald-400" },
    error: { text: "Failed", className: "text-red-600 dark:text-red-400" },
  };
  const { text, className } = map[status];
  return <span className={cn("shrink-0 text-[11px] font-medium", className)}>{text}</span>;
}
