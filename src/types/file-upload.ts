import type { TimestampAuditFields } from "./audit";
import type { EntityId, IsoDateTime } from "./core";

export type FilePurpose = "source-resume" | "gcc-profile-photo";

export type FileUploadStatus =
  | "pending"
  | "uploading"
  | "available"
  | "failed"
  | "replaced";

export type FileAccessLevel = "private";

export type ResumeFileMimeType =
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ResumeFileExtension = "doc" | "docx" | "pdf";

export type ProfilePhotoMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export type ProfilePhotoFileExtension = "jpg" | "jpeg" | "png" | "webp";

export type SupportedUploadMimeType =
  | ResumeFileMimeType
  | ProfilePhotoMimeType;

export type SupportedUploadFileExtension =
  | ResumeFileExtension
  | ProfilePhotoFileExtension;

/** Placeholder for a private object in a future storage provider. */
export interface StorageObjectReference {
  bucketName: string;
  objectKey: string;
}

/** Reference to a successfully stored private file. */
export interface PrivateFileReference<
  TMimeType extends string = string,
  TExtension extends string = string,
> {
  id: EntityId;
  originalFileName: string;
  storedFileName: string;
  mimeType: TMimeType;
  fileExtension: TExtension;
  sizeBytes: number;
  storage: StorageObjectReference;
  accessLevel: "private";
  uploadedAt: IsoDateTime;
}

interface BaseFileUploadRecord<
  TPurpose extends FilePurpose,
  TMimeType extends SupportedUploadMimeType,
  TExtension extends SupportedUploadFileExtension,
> extends TimestampAuditFields {
  id: EntityId;
  candidateProfileId: EntityId;
  purpose: TPurpose;
  originalFileName: string;
  mimeType: TMimeType;
  fileExtension: TExtension;
  sizeBytes: number;
  accessLevel: FileAccessLevel;
  versionNumber: number;
  replacesFileId?: EntityId;
}

type PendingFileUploadRecord<
  TPurpose extends FilePurpose,
  TMimeType extends SupportedUploadMimeType,
  TExtension extends SupportedUploadFileExtension,
> = BaseFileUploadRecord<TPurpose, TMimeType, TExtension> & {
  status: "pending" | "uploading" | "failed";
  storedFileName?: never;
  storage?: never;
  uploadedAt?: never;
};

type StoredFileUploadRecord<
  TPurpose extends FilePurpose,
  TMimeType extends SupportedUploadMimeType,
  TExtension extends SupportedUploadFileExtension,
> = BaseFileUploadRecord<TPurpose, TMimeType, TExtension> & {
  status: "available" | "replaced";
  storedFileName: string;
  storage: StorageObjectReference;
  uploadedAt: IsoDateTime;
};

type FileUploadRecordFor<
  TPurpose extends FilePurpose,
  TMimeType extends SupportedUploadMimeType,
  TExtension extends SupportedUploadFileExtension,
> =
  | PendingFileUploadRecord<TPurpose, TMimeType, TExtension>
  | StoredFileUploadRecord<TPurpose, TMimeType, TExtension>;

export type SourceResumeUploadRecord = FileUploadRecordFor<
  "source-resume",
  ResumeFileMimeType,
  ResumeFileExtension
>;

export type GccProfilePhotoUploadRecord = FileUploadRecordFor<
  "gcc-profile-photo",
  ProfilePhotoMimeType,
  ProfilePhotoFileExtension
>;

export type FileUploadRecord =
  | SourceResumeUploadRecord
  | GccProfilePhotoUploadRecord;
