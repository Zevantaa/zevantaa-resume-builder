import type {
  ResumeExtractionFailureReason,
  ResumeExtractionStatus,
  ResumeExtractionWarning,
  ResumeExtractor,
} from "@/types/resume-extraction";

export interface ExtractionTestOutcome {
  status: ResumeExtractionStatus;
  extractor: ResumeExtractor | null;
  pageCount: number | null;
  warnings: ResumeExtractionWarning[];
  failureReason: ResumeExtractionFailureReason | null;
  preview: string | null;
  previewTruncated: boolean;
}
