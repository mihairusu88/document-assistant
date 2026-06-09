import mammoth from "mammoth";
import { PdfReader } from "pdfreader";
import WordExtractor from "word-extractor";
import { fileExtension } from "@/utils/files";

export interface ExtractTextInput {
  /** Raw file bytes. */
  buffer: Buffer;
  /** Browser-reported MIME type (may be empty/unreliable for .doc). */
  mimeType: string;
  /** Original file name — used as an extension fallback. */
  fileName: string;
}

/**
 * Step 1 of the RAG pipeline: turn an uploaded file (PDF / DOC / DOCX / Text)
 * into plain text. Runs server-side (Node runtime) — the parsers are Node libs.
 */
export class ExtractTextService {
  async extractText(input: ExtractTextInput): Promise<string> {
    const { buffer, mimeType, fileName } = input;
    const ext = fileExtension(fileName);

    if (mimeType === "application/pdf" || ext === "pdf") {
      return this.fromPdf(buffer);
    }
    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return this.fromDocx(buffer);
    }
    if (mimeType === "application/msword" || ext === "doc") {
      return this.fromDoc(buffer);
    }
    if (mimeType === "text/plain" || ext === "txt") {
      return buffer.toString("utf-8");
    }

    throw new Error(
      `Unsupported file type (mime: "${mimeType}", name: "${fileName}"). Allowed: PDF, DOC, DOCX, Text.`,
    );
  }

  /** PDF via `pdfreader` (event-based — wrapped in a Promise). */
  private fromPdf(buffer: Buffer): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const parts: string[] = [];
      let lastPage = 0;

      new PdfReader().parseBuffer(buffer, (err, item) => {
        if (err) {
          reject(new Error(typeof err === "string" ? err : "Failed to parse PDF."));
          return;
        }
        if (!item) {
          // End of file.
          resolve(parts.join(" ").replace(/\s+/g, " ").trim());
          return;
        }
        if (item.page) {
          // New page boundary.
          if (item.page !== lastPage) {
            parts.push("\n");
            lastPage = item.page;
          }
          return;
        }
        if (item.text) parts.push(item.text);
      });
    });
  }

  /** DOCX via `mammoth`. */
  private async fromDocx(buffer: Buffer): Promise<string> {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  /** Legacy DOC via `word-extractor`. */
  private async fromDoc(buffer: Buffer): Promise<string> {
    const doc = await new WordExtractor().extract(buffer);
    return doc.getBody().trim();
  }
}
