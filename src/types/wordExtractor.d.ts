// Minimal type declaration for `word-extractor` (ships no types).
declare module "word-extractor" {
  interface ExtractedDocument {
    getBody(): string;
    getHeaders(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getFooters(): string;
  }

  export default class WordExtractor {
    extract(source: string | Buffer): Promise<ExtractedDocument>;
  }
}
