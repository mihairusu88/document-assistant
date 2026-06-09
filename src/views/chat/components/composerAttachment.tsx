"use client";

import { FileText, Loader2, X } from "lucide-react";
import { fileExtension, formatBytes } from "@/utils/files";

/**
 * Card shown inside the composer once a file is staged (before submit).
 * Mirrors the ChatGPT/Claude attachment chip: file-type badge, name, size,
 * and a remove button. The file isn't ingested until the user submits.
 */
export function ComposerAttachment({
  file,
  busy = false,
  onRemove,
}: {
  file: File;
  busy?: boolean;
  onRemove: () => void;
}) {
  const ext = fileExtension(file.name).toUpperCase() || "FILE";

  return (
    <div className="mb-2 inline-flex max-w-xs items-center gap-3 rounded-xl border bg-muted/40 p-2 pr-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <FileText className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className="block text-xs text-muted-foreground">
          {ext} · {formatBytes(file.size)}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label="Remove attachment"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
