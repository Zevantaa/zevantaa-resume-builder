import "server-only";

import { resolveLinkedClientProfile } from "@/features/client-portal/contact-profile-service";
import { RESUME_LIMIT_BYTES } from "@/features/client-portal/intake-file-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ResumeExtractionResult } from "@/types/resume-extraction";

import { extractionFailure, extractResumeTextFromBytes } from "./extract-resume-text";

const PRIVATE_BUCKET = "candidate-intake-private";

/**
 * Authorized entry point. The caller supplies no profile ID, file ID, bucket,
 * or object key; each is resolved from the active client's linked profile.
 */
export async function extractCurrentClientSourceResume(): Promise<ResumeExtractionResult> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return extractionFailure(null, null, null, "source-unavailable");

  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("candidate_profiles")
    .select("existing_resume_file_id")
    .eq("id", linked.profileId)
    .is("archived_at", null)
    .maybeSingle();
  if (profileError || !profile?.existing_resume_file_id) {
    return extractionFailure(null, null, null, "source-unavailable");
  }

  const fileId = profile.existing_resume_file_id;
  const { data: file, error: fileError } = await supabase
    .from("file_records")
    .select("id, candidate_profile_id, purpose, status, access_level, mime_type, file_extension, size_bytes, stored_file_name, storage_bucket_name, storage_object_key")
    .eq("id", fileId)
    .eq("candidate_profile_id", linked.profileId)
    .eq("purpose", "source-resume")
    .eq("status", "available")
    .is("archived_at", null)
    .maybeSingle();
  if (fileError || !file) {
    return extractionFailure(fileId, null, null, "source-unavailable");
  }

  const expectedName = `${file.id}.${file.file_extension}`;
  const expectedKey = `${linked.profileId}/source-resume/${expectedName}`;
  if (file.candidate_profile_id !== linked.profileId || file.purpose !== "source-resume" ||
      file.status !== "available" || file.access_level !== "private" ||
      file.storage_bucket_name !== PRIVATE_BUCKET || file.stored_file_name !== expectedName ||
      file.storage_object_key !== expectedKey || !Number.isSafeInteger(file.size_bytes) ||
      file.size_bytes <= 0 || file.size_bytes > RESUME_LIMIT_BYTES) {
    return extractionFailure(fileId, file.mime_type, file.file_extension, "unsafe-storage-reference");
  }

  const { data: bucket, error: bucketError } = await supabase.storage.getBucket(PRIVATE_BUCKET);
  if (bucketError || !bucket || bucket.public) {
    return extractionFailure(fileId, file.mime_type, file.file_extension, "unsafe-storage-reference");
  }
  const { data: object, error: downloadError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .download(expectedKey);
  if (downloadError || !object) {
    return extractionFailure(fileId, file.mime_type, file.file_extension, "source-unavailable");
  }
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.length !== file.size_bytes) {
    return extractionFailure(fileId, file.mime_type, file.file_extension, "invalid-file");
  }
  return extractResumeTextFromBytes({
    sourceFileId: fileId,
    sourceMimeType: file.mime_type,
    sourceExtension: file.file_extension,
    bytes,
  });
}
