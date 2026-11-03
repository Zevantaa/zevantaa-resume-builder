import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPackageRouting, V1_DOCUMENT_OUTPUTS } from "@/features/document-generation/package-routing";
import type { PdfOutputKind } from "@/features/document-generation/pdf/pdf-filename";

import { isDownloadableClientDocument, resolveStoredDocumentOutput,
  type StoredDocumentFileRow, type StoredDocumentRow } from "./client-document-access";
import { resolveLinkedClientProfile } from "./contact-profile-service";

export type ClientDashboardEvidence = {
  packageCode: string;
  resume: { fileName: string; status: string; versionNumber: number } | null;
  photo: { fileName: string; status: string } | null;
  reviewConfirmed: boolean;
  downloadableDocuments: Partial<Record<PdfOutputKind, string>>;
  documentDetails: Partial<Record<PdfOutputKind, { version: number; generatedAt: string }>>;
  documentUpdates: Partial<Record<PdfOutputKind, "updating" | "failed">>;
};

/** Only the active client's trusted role-to-profile link determines every query. */
export async function getClientDashboardEvidence(): Promise<ClientDashboardEvidence | null> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;
  const db = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await db.from("candidate_profiles")
    .select("selected_package_code, existing_resume_file_id, gcc_photo_file_id, career_revision")
    .eq("id", linked.profileId).is("archived_at", null).maybeSingle();
  if (profileError) throw new Error("The client dashboard could not be loaded.");
  if (!profile) return null;

  const currentIds = [profile.existing_resume_file_id, profile.gcc_photo_file_id].filter((id): id is string => typeof id === "string");
  const [currentFilesResult, reviewResult, processingResult, documentsResult, jobsResult] = await Promise.all([
    currentIds.length ? db.from("file_records")
      .select("id, purpose, original_file_name, status, version_number, candidate_profile_id")
      .eq("candidate_profile_id", linked.profileId).in("id", currentIds).is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
    profile.existing_resume_file_id ? db.from("profile_resume_reviews")
      .select("id").eq("candidate_profile_id", linked.profileId)
      .eq("source_file_id", profile.existing_resume_file_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.existing_resume_file_id ? db.from("resume_processing_jobs")
      .select("status, input_confirmed_by_user_id").eq("candidate_profile_id", linked.profileId)
      .eq("source_file_id", profile.existing_resume_file_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("document_records")
      .select("id, candidate_profile_id, category, origin, status, package_code, resume_format_family, cover_letter_type, is_privacy_masked, file_name_stem, file_record_id, output_kind, source_career_revision, version_number, generated_at")
      .eq("candidate_profile_id", linked.profileId).eq("origin", "generated")
      .eq("status", "available").is("archived_at", null).order("created_at", { ascending: false }),
    db.from("document_regeneration_jobs").select("output_kind, status")
      .eq("candidate_profile_id", linked.profileId).eq("source_career_revision", profile.career_revision)
      .in("status", ["pending", "processing", "failed"]),
  ]);
  if (currentFilesResult.error || reviewResult.error || processingResult.error || documentsResult.error || jobsResult.error) {
    throw new Error("The client dashboard status could not be loaded.");
  }

  const rows = (currentFilesResult.data ?? []) as {
    id: string; purpose: string; original_file_name: string; status: string; version_number: number;
  }[];
  const resumeRow = rows.find((row) => row.id === profile.existing_resume_file_id && row.purpose === "source-resume");
  const photoRow = rows.find((row) => row.id === profile.gcc_photo_file_id && row.purpose === "gcc-profile-photo");
  const documents = (documentsResult.data ?? []) as StoredDocumentRow[];
  const fileIds = [...new Set(documents.map((row) => row.file_record_id).filter((id): id is string => typeof id === "string"))];
  const { data: fileRows, error: filesError } = fileIds.length ? await db.from("file_records")
    .select("id, candidate_profile_id, purpose, status, access_level, mime_type, file_extension, size_bytes, stored_file_name, storage_bucket_name, storage_object_key")
    .eq("candidate_profile_id", linked.profileId).in("id", fileIds).is("archived_at", null)
    : { data: [], error: null };
  if (filesError) throw new Error("The document status could not be loaded.");
  const filesById = new Map(((fileRows ?? []) as StoredDocumentFileRow[]).map((row) => [row.id, row]));
  const downloadableDocuments: ClientDashboardEvidence["downloadableDocuments"] = {};
  const documentDetails: ClientDashboardEvidence["documentDetails"] = {};
  const documentUpdates: ClientDashboardEvidence["documentUpdates"] = {};
  for (const job of jobsResult.data ?? []) {
    if (V1_DOCUMENT_OUTPUTS.some((output) => output === job.output_kind)) {
      documentUpdates[job.output_kind as PdfOutputKind] = job.status === "failed" ? "failed" : "updating";
    }
  }
  if (getPackageRouting(profile.selected_package_code)) {
    for (const document of documents) {
      const output = resolveStoredDocumentOutput(document);
      if (output && !downloadableDocuments[output] &&
          isDownloadableClientDocument(document, filesById.get(document.file_record_id ?? "") ?? null,
            linked.profileId, profile.selected_package_code, profile.career_revision)) {
        downloadableDocuments[output] = document.id;
        documentDetails[output] = { version: document.version_number, generatedAt: document.generated_at ?? "" };
      }
    }
  }
  return {
    packageCode: profile.selected_package_code,
    resume: resumeRow ? { fileName: resumeRow.original_file_name, status: resumeRow.status,
      versionNumber: resumeRow.version_number } : null,
    photo: photoRow ? { fileName: photoRow.original_file_name, status: photoRow.status } : null,
    reviewConfirmed: Boolean(resumeRow?.status === "available" && (reviewResult.data ||
      (processingResult.data?.status === "completed" && processingResult.data.input_confirmed_by_user_id))),
    downloadableDocuments,
    documentDetails,
    documentUpdates,
  };
}
