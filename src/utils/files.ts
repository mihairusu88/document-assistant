/**
 * File helpers for the document upload (client validation + server checks).
 * Pure, stateless functions only.
 */

/** MIME types accepted by the upload: PDF, DOC, DOCX, Text. */
export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_DOCUMENT_MIME_TYPES)[number];

/** Maps accepted MIME types to a human label. */
export const MIME_LABELS: Record<AcceptedMimeType, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/plain": "Text",
};

/** File extensions accepted by the upload. */
export const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "txt"] as const;

/** Maximum upload size: 10 MB. */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export function isAcceptedMimeType(mime: string): mime is AcceptedMimeType {
  return (ACCEPTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

/** Lowercased file extension (without the dot), or "". */
export function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

/**
 * Accept by MIME type OR extension — browsers sometimes report an empty/odd
 * MIME for `.doc`/`.docx`, so the extension is a reliable fallback.
 */
export function isAcceptedFile(fileName: string, mime: string): boolean {
  return (
    isAcceptedMimeType(mime) ||
    (ACCEPTED_EXTENSIONS as readonly string[]).includes(fileExtension(fileName))
  );
}

/** Build the `accept` attribute for a file input. */
export function fileInputAccept(): string {
  return ".pdf,.doc,.docx,.txt";
}

/** Human-readable byte size, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
