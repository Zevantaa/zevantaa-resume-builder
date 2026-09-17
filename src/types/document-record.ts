import type { TimestampAuditFields } from "./audit";
import type { V1PackageCode } from "./client-profile";
import type { EntityId, IsoDateTime } from "./core";
import type {
  PrivateFileReference,
  ResumeFileExtension,
  ResumeFileMimeType,
} from "./file-upload";
import type { ResumeFormatFamily } from "./package";

export type DocumentCategory = "source-resume" | "resume" | "cover-letter";

export type DocumentOrigin = "uploaded" | "generated";

export type DocumentStatus =
  | "pending"
  | "processing"
  | "available"
  | "failed"
  | "archived";

export type CoverLetterType =
  | "general-corporate"
  | "international-relocation"
  | "technology-startup";

export type GeneratedDocumentMimeType = "application/pdf";

export type DocumentFileExtension = "doc" | "docx" | "pdf";

/** Components used to produce a stable generated file name. */
export interface DocumentNamingMetadata<
  TExtension extends DocumentFileExtension = DocumentFileExtension,
> {
  fileNameStem: string;
  fileExtension: TExtension;
}

interface BaseDocumentRecord extends TimestampAuditFields {
  id: EntityId;
  candidateProfileId: EntityId;
  category: DocumentCategory;
  origin: DocumentOrigin;
  status: DocumentStatus;
  versionNumber: number;
}

export interface UploadedSourceResumeDocumentRecord
  extends BaseDocumentRecord {
  category: "source-resume";
  origin: "uploaded";
  packageCode?: V1PackageCode;
  isPrivacyMasked: false;
  file: PrivateFileReference<ResumeFileMimeType, ResumeFileExtension>;
  naming?: DocumentNamingMetadata;
}

interface BaseGeneratedDocumentRecord extends BaseDocumentRecord {
  origin: "generated";
  packageCode: V1PackageCode;
  file?: PrivateFileReference<GeneratedDocumentMimeType, "pdf">;
  naming: DocumentNamingMetadata<"pdf">;
  generatedAt?: IsoDateTime;
  exportedAt?: IsoDateTime;
}

export interface GeneratedResumeDocumentRecord
  extends BaseGeneratedDocumentRecord {
  category: "resume";
  resumeFormatFamily: ResumeFormatFamily;
  isPrivacyMasked: false;
}

/**
 * Separate employer-review output. `privacyMaskSourceDocumentId` identifies
 * the unmasked generated resume and prevents the original from being replaced.
 */
export interface PrivacyMaskedResumeDocumentRecord
  extends BaseGeneratedDocumentRecord {
  category: "resume";
  resumeFormatFamily: ResumeFormatFamily;
  isPrivacyMasked: true;
  privacyMaskSourceDocumentId: EntityId;
}

export interface GeneratedCoverLetterDocumentRecord
  extends BaseGeneratedDocumentRecord {
  category: "cover-letter";
  coverLetterType: CoverLetterType;
  isPrivacyMasked: false;
}

export type DocumentRecord =
  | UploadedSourceResumeDocumentRecord
  | GeneratedResumeDocumentRecord
  | PrivacyMaskedResumeDocumentRecord
  | GeneratedCoverLetterDocumentRecord;
