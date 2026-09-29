import type { EntityId } from "./core";

export type ResumeExtractor = "word-extractor" | "mammoth" | "pdfjs-dist";
export type ResumeExtractionStatus = "success" | "insufficient-text" | "unsupported" | "failed";
export type ResumeExtractionFailureReason =
  | "unsupported-format"
  | "invalid-file"
  | "corrupt-file"
  | "encrypted-file"
  | "active-content"
  | "extraction-limit"
  | "insufficient-text"
  | "source-unavailable"
  | "unsafe-storage-reference";

export interface ResumeExtractionWarning {
  code: "conversion-warning" | "low-text-page";
  message: string;
}

/** Ephemeral output only: never persist raw text or parsed facts in this batch. */
export interface ResumeExtractionResult {
  sourceFileId: EntityId | null;
  sourceMimeType: string | null;
  sourceExtension: string | null;
  extractor: ResumeExtractor | null;
  rawText: string | null;
  normalizedText: string | null;
  pageCount: number | null;
  warnings: ResumeExtractionWarning[];
  status: ResumeExtractionStatus;
  failureReason: ResumeExtractionFailureReason | null;
}
