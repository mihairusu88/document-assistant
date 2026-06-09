import { FileText } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/files";
import type { DocumentDTO } from "@/types/entities";

const STATUS_LABEL: Record<DocumentDTO["status"], string> = {
  pending: "pending",
  processing: "processing…",
  ready: "ready",
  failed: "failed",
};

/** Attached-document chips shown above the composer input. */
export function DocumentChips({ documents }: { documents: DocumentDTO[] }) {
  if (documents.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2">
      {documents.map((d) => (
        <span
          key={d.id}
          className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
          title={`${formatBytes(d.sizeBytes)} · ${STATUS_LABEL[d.status]}`}
        >
          <FileText className="size-3.5 text-muted-foreground" />
          <span className="max-w-40 truncate">{d.fileName}</span>
          <span
            className={cn(
              "text-[10px] uppercase tracking-wide",
              d.status === "ready" && "text-emerald-600 dark:text-emerald-400",
              d.status === "failed" && "text-destructive",
              (d.status === "pending" || d.status === "processing") &&
                "text-muted-foreground",
            )}
          >
            {STATUS_LABEL[d.status]}
          </span>
        </span>
      ))}
    </div>
  );
}
