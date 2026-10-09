import "server-only";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { isDownloadableClientDocument, resolveStoredDocumentOutput,
  type StoredDocumentFileRow, type StoredDocumentRow } from "@/features/client-portal/client-document-access";
import { OUTPUT_TITLES } from "@/features/client-portal/client-dashboard-view";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { ADMIN_DIRECTORY_PAGE_SIZE, ADMIN_DIRECTORY_SCAN_LIMIT, filterAdminDirectory,
  getAdminResumeStatus, packageNameForDirectory,
  type AdminDirectoryFilters, type AdminDirectoryRow } from "./admin-directory-model";

const SCAN_BATCH_SIZE = 200;
const MAX_DOCUMENT_ROWS = 1000;

export type AdminStoredDocument = {
  id: string;
  profileId: string;
  label: string;
  createdAt: string;
};

/** Count only available, generated, unmasked PDFs with a verified private file. */
async function loadVerifiedDocuments(
  db: ReturnType<typeof createSupabaseAdminClient>,
  profileIds: string[],
): Promise<AdminStoredDocument[]> {
  if (!profileIds.length) return [];
  const { data: documents, count, error } = await db.from("document_records")
    .select("id, candidate_profile_id, category, origin, status, package_code, resume_format_family, cover_letter_type, is_privacy_masked, file_name_stem, file_record_id, created_at", { count: "exact" })
    .in("candidate_profile_id", profileIds).eq("origin", "generated").eq("status", "available")
    .is("archived_at", null).order("created_at", { ascending: false }).range(0, MAX_DOCUMENT_ROWS - 1);
  if (error || (count ?? 0) > MAX_DOCUMENT_ROWS) throw new Error("Stored documents could not be loaded completely.");
  const documentRows = (documents ?? []) as (StoredDocumentRow & { created_at: string })[];
  const fileIds = [...new Set(documentRows.map((row) => row.file_record_id).filter((id): id is string => !!id))];
  if (!fileIds.length) return [];
  const { data: files, error: fileError } = await db.from("file_records")
    .select("id, candidate_profile_id, purpose, status, access_level, mime_type, file_extension, size_bytes, stored_file_name, storage_bucket_name, storage_object_key")
    .in("id", fileIds).in("candidate_profile_id", profileIds).is("archived_at", null);
  if (fileError) throw new Error("Stored document files could not be loaded.");
  const byId = new Map(((files ?? []) as StoredDocumentFileRow[]).map((file) => [file.id, file]));
  return documentRows.flatMap((document) => {
    const output = resolveStoredDocumentOutput(document);
    if (!output || !isDownloadableClientDocument(document, byId.get(document.file_record_id ?? "") ?? null,
      document.candidate_profile_id, document.package_code)) return [];
    return [{ id: document.id, profileId: document.candidate_profile_id,
      label: OUTPUT_TITLES[output], createdAt: document.created_at }];
  });
}

export async function getAdminStoredDocuments(profileId: string): Promise<AdminStoredDocument[]> {
  await requireApplicationRole("admin");
  return loadVerifiedDocuments(createSupabaseAdminClient(), [profileId]);
}

export async function getAdminDirectoryData(filters: AdminDirectoryFilters) {
  await requireApplicationRole("admin");
  const db = createSupabaseAdminClient();
  const rows: AdminDirectoryRow[] = [];
  for (let offset = 0; offset <= ADMIN_DIRECTORY_SCAN_LIMIT; offset += SCAN_BATCH_SIZE) {
    const { data: roles, error } = await db.from("user_roles")
      .select("user_id, candidate_profile_id, account_status")
      .eq("role_code", "client").not("candidate_profile_id", "is", null)
      .order("user_id").range(offset, offset + SCAN_BATCH_SIZE - 1);
    if (error) throw new Error("The client directory could not be loaded.");
    if (!roles?.length) break;
    if (offset + roles.length > ADMIN_DIRECTORY_SCAN_LIMIT) {
      throw new Error("The client directory exceeds the current safe scan limit.");
    }
    const ids = roles.map((role) => role.candidate_profile_id).filter((id): id is string => !!id);
    const { data: profiles, error: profileError } = await db.from("candidate_profiles")
      .select("id, full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, selected_package_code, existing_resume_file_id")
      .in("id", ids).is("archived_at", null);
    if (profileError) throw new Error("Client profiles could not be loaded.");
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const resumeIds = [...new Set((profiles ?? []).map((profile) => profile.existing_resume_file_id)
      .filter((id): id is string => !!id))];
    const [{ data: files, error: fileError }, { data: reviews, error: reviewError }] = await Promise.all([
      resumeIds.length ? db.from("file_records").select("id, candidate_profile_id")
        .in("id", resumeIds).eq("purpose", "source-resume").eq("status", "available").is("archived_at", null)
        : Promise.resolve({ data: [], error: null }),
      resumeIds.length ? db.from("profile_resume_reviews").select("candidate_profile_id, source_file_id")
        .in("source_file_id", resumeIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (fileError || reviewError) throw new Error("Client review status could not be loaded.");
    const available = new Set((files ?? []).map((file) => `${file.candidate_profile_id}:${file.id}`));
    const confirmed = new Set((reviews ?? []).map((review) => `${review.candidate_profile_id}:${review.source_file_id}`));
    for (const role of roles) {
      const profile = profileById.get(role.candidate_profile_id ?? "");
      if (!profile) continue;
      const resumeId = profile.existing_resume_file_id;
      const hasSourceResume = !!resumeId && available.has(`${profile.id}:${resumeId}`);
      rows.push({
        userId: role.user_id, profileId: profile.id, fullName: profile.full_name,
        email: profile.primary_email, mobileNumber: profile.mobile_number,
        whatsappNumber: profile.whatsapp_number, linkedinUrl: profile.linkedin_url,
        packageCode: profile.selected_package_code,
        packageName: packageNameForDirectory(profile.selected_package_code),
        accountStatus: role.account_status,
        resumeStatus: getAdminResumeStatus(resumeId, hasSourceResume,
          !!resumeId && confirmed.has(`${profile.id}:${resumeId}`)),
        hasSourceResume, generatedFileCount: 0,
      });
    }
    if (roles.length < SCAN_BATCH_SIZE) break;
  }
  rows.sort((a, b) => a.fullName.localeCompare(b.fullName) || a.userId.localeCompare(b.userId));
  const matching = filterAdminDirectory(rows, filters);
  const pageCount = Math.max(1, Math.ceil(matching.length / ADMIN_DIRECTORY_PAGE_SIZE));
  const currentPage = Math.min(filters.page, pageCount);
  const pageRows = matching.slice((currentPage - 1) * ADMIN_DIRECTORY_PAGE_SIZE, currentPage * ADMIN_DIRECTORY_PAGE_SIZE);
  const documents = await loadVerifiedDocuments(db, pageRows.map((row) => row.profileId));
  const counts = new Map<string, number>();
  for (const document of documents) counts.set(document.profileId, (counts.get(document.profileId) ?? 0) + 1);
  for (const row of pageRows) row.generatedFileCount = counts.get(row.profileId) ?? 0;
  return {
    rows: pageRows,
    totalMatching: matching.length,
    pageCount,
    currentPage,
    metrics: {
      clients: rows.length,
      sourceResumes: rows.filter((row) => row.hasSourceResume).length,
      awaitingReview: rows.filter((row) => row.resumeStatus === "under-review").length,
      reviewed: rows.filter((row) => row.resumeStatus === "reviewed").length,
      generatedOnPage: documents.length,
    },
  };
}
