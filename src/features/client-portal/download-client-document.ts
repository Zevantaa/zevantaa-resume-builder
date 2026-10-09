import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizePdfDownloadFilename } from "@/features/document-generation/pdf/pdf-filename";

import { isDownloadableClientDocument, PRIVATE_DOCUMENT_BUCKET,
  type StoredDocumentFileRow, type StoredDocumentRow } from "./client-document-access";
import { resolveLinkedClientProfile } from "./contact-profile-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** No browser-supplied profile, file, bucket, or path is accepted. */
export async function downloadCurrentClientDocument(documentId: string): Promise<{
  bytes: Uint8Array;
  filename: string;
} | null> {
  const linked = await resolveLinkedClientProfile();
  if (!linked || !UUID.test(documentId)) return null;
  const db = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await db.from("candidate_profiles")
    .select("selected_package_code").eq("id", linked.profileId)
    .is("archived_at", null).maybeSingle();
  if (profileError || !profile) return null;
  const { data: document, error: documentError } = await db.from("document_records")
    .select("id, candidate_profile_id, category, origin, status, package_code, resume_format_family, cover_letter_type, is_privacy_masked, file_name_stem, file_record_id")
    .eq("id", documentId).eq("candidate_profile_id", linked.profileId)
    .eq("origin", "generated").eq("status", "available")
    .is("archived_at", null).maybeSingle();
  if (documentError || !document?.file_record_id) return null;
  const { data: file, error: fileError } = await db.from("file_records")
    .select("id, candidate_profile_id, purpose, status, access_level, mime_type, file_extension, size_bytes, stored_file_name, storage_bucket_name, storage_object_key")
    .eq("id", document.file_record_id).eq("candidate_profile_id", linked.profileId)
    .eq("status", "available").is("archived_at", null).maybeSingle();
  const storedFile = file as StoredDocumentFileRow | null;
  if (fileError || !isDownloadableClientDocument(document as StoredDocumentRow,
    storedFile, linked.profileId, profile.selected_package_code)) return null;

  const { data: bucket, error: bucketError } = await db.storage.getBucket(PRIVATE_DOCUMENT_BUCKET);
  if (bucketError || !bucket || bucket.public) return null;
  const { data: object, error: downloadError } = await db.storage.from(PRIVATE_DOCUMENT_BUCKET)
    .download(storedFile.storage_object_key!);
  if (downloadError || !object) return null;
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.length !== storedFile.size_bytes || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return null;
  return { bytes, filename: sanitizePdfDownloadFilename(`${document.file_name_stem}.pdf`) };
}
