import { packageAllowsOutput, V1_DOCUMENT_OUTPUTS } from "@/features/document-generation/package-routing";
import type { PdfOutputKind } from "@/features/document-generation/pdf/pdf-filename";

export const PRIVATE_DOCUMENT_BUCKET = "candidate-documents-private";
export const MAX_CLIENT_PDF_BYTES = 10 * 1024 * 1024;

export type StoredDocumentRow = {
  id: string;
  candidate_profile_id: string;
  category: string;
  origin: string;
  status: string;
  package_code: string | null;
  resume_format_family: string | null;
  cover_letter_type: string | null;
  is_privacy_masked: boolean;
  file_name_stem: string | null;
  file_record_id: string | null;
  output_kind: string | null;
  source_career_revision: number | null;
  version_number: number;
  generated_at: string | null;
};

export type StoredDocumentFileRow = {
  id: string;
  candidate_profile_id: string;
  purpose: string;
  status: string;
  access_level: string;
  mime_type: string;
  file_extension: string;
  size_bytes: number;
  stored_file_name: string | null;
  storage_bucket_name: string | null;
  storage_object_key: string | null;
};

/** Output identity is a database enum, never inferred from a mutable filename. */
export function resolveStoredDocumentOutput(document: StoredDocumentRow): PdfOutputKind | null {
  if (document.origin !== "generated" || document.status !== "available" ||
      document.is_privacy_masked || !document.file_name_stem || !document.file_record_id) return null;
  return V1_DOCUMENT_OUTPUTS.find((output) => output === document.output_kind) ?? null;
}

/** Metadata gate shared by dashboard visibility and the final download boundary. */
export function isDownloadableClientDocument(
  document: StoredDocumentRow,
  file: StoredDocumentFileRow | null,
  profileId: string,
  packageCode: unknown,
  careerRevision?: number,
): file is StoredDocumentFileRow {
  const output = resolveStoredDocumentOutput(document);
  if (!output || !packageAllowsOutput(packageCode, output) || document.package_code !== packageCode ||
      (careerRevision !== undefined && document.source_career_revision !== careerRevision) ||
      document.candidate_profile_id !== profileId || !file || document.file_record_id !== file.id ||
      file.candidate_profile_id !== profileId || file.purpose !== "generated-document" ||
      file.status !== "available" || file.access_level !== "private" ||
      file.mime_type !== "application/pdf" || file.file_extension !== "pdf" ||
      !Number.isSafeInteger(file.size_bytes) || file.size_bytes <= 0 || file.size_bytes > MAX_CLIENT_PDF_BYTES ||
      file.storage_bucket_name !== PRIVATE_DOCUMENT_BUCKET || file.stored_file_name !== `${file.id}.pdf` ||
      file.storage_object_key !== `${profileId}/${document.id}/${file.id}.pdf`) return false;
  return true;
}

/** Admin history includes superseded/outdated and privacy-masked versions. */
export function isDownloadableAdminDocument(
  document: StoredDocumentRow, file: StoredDocumentFileRow | null, profileId: string,
): file is StoredDocumentFileRow {
  if (document.candidate_profile_id !== profileId || document.origin !== "generated" ||
      !["available", "superseded", "outdated"].includes(document.status) ||
      !document.output_kind || !document.file_record_id || !document.file_name_stem ||
      (document.is_privacy_masked !== (document.output_kind === "global-ats-employer-masked")) ||
      !file || file.id !== document.file_record_id || file.candidate_profile_id !== profileId ||
      file.purpose !== "generated-document" || file.status !== "available" ||
      file.access_level !== "private" || file.mime_type !== "application/pdf" ||
      file.file_extension !== "pdf" || !Number.isSafeInteger(file.size_bytes) ||
      file.size_bytes <= 0 || file.size_bytes > MAX_CLIENT_PDF_BYTES ||
      file.storage_bucket_name !== PRIVATE_DOCUMENT_BUCKET ||
      file.stored_file_name !== `${file.id}.pdf` ||
      file.storage_object_key !== `${profileId}/${document.id}/${file.id}.pdf`) return false;
  return true;
}
