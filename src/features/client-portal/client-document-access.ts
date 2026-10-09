import { packageAllowsOutput, V1_DOCUMENT_OUTPUTS } from "@/features/document-generation/package-routing";
import { buildPdfFilename, type PdfOutputKind } from "@/features/document-generation/pdf/pdf-filename";

export const PRIVATE_DOCUMENT_BUCKET = "candidate-intake-private";
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

const RESUME_FAMILY: Partial<Record<PdfOutputKind, string>> = {
  "global-ats-resume": "global-ats",
  "domestic-resume-1": "domestic",
  "domestic-resume-2": "domestic",
  "domestic-resume-3": "domestic",
  "domestic-resume-4": "domestic",
  "domestic-resume-5": "domestic",
  "gcc-resume": "gcc-middle-east",
  "europass-eu-resume": "europass-european-union",
};

/** A document's family alone cannot distinguish the five domestic designs. */
export function resolveStoredDocumentOutput(document: StoredDocumentRow): PdfOutputKind | null {
  if (document.origin !== "generated" || document.status !== "available" ||
      document.is_privacy_masked || !document.file_name_stem || !document.file_record_id) return null;
  for (const output of V1_DOCUMENT_OUTPUTS) {
    const suffix = buildPdfFilename({ candidateName: "Candidate", output }).slice("Candidate".length, -4);
    if (!document.file_name_stem.endsWith(suffix)) continue;
    if (output.endsWith("cover-letter")) {
      if (document.category === "cover-letter" && document.cover_letter_type === output.slice(0, -"-cover-letter".length) &&
          document.resume_format_family === null) return output;
    } else if (document.category === "resume" && document.resume_format_family === RESUME_FAMILY[output] &&
               document.cover_letter_type === null) return output;
  }
  return null;
}

/** Metadata gate shared by dashboard visibility and the final download boundary. */
export function isDownloadableClientDocument(
  document: StoredDocumentRow,
  file: StoredDocumentFileRow | null,
  profileId: string,
  packageCode: unknown,
): file is StoredDocumentFileRow {
  const output = resolveStoredDocumentOutput(document);
  if (!output || !packageAllowsOutput(packageCode, output) || document.package_code !== packageCode ||
      document.candidate_profile_id !== profileId || !file || document.file_record_id !== file.id ||
      file.candidate_profile_id !== profileId || file.purpose === "gcc-profile-photo" ||
      file.status !== "available" || file.access_level !== "private" ||
      file.mime_type !== "application/pdf" || file.file_extension !== "pdf" ||
      !Number.isSafeInteger(file.size_bytes) || file.size_bytes <= 0 || file.size_bytes > MAX_CLIENT_PDF_BYTES ||
      file.storage_bucket_name !== PRIVATE_DOCUMENT_BUCKET || file.stored_file_name !== `${file.id}.pdf` ||
      file.storage_object_key !== `${profileId}/generated/${file.id}.pdf`) return false;
  return true;
}
