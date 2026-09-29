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

/** In-memory extraction output. Review confirmation stores only a digest and approved entries. */
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
