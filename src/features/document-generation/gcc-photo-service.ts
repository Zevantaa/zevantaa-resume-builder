import "server-only";

import sharp from "sharp";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { hasSupportedFileSignature, PHOTO_LIMIT_BYTES } from "@/features/client-portal/intake-file-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PrivateFileReference, ProfilePhotoFileExtension, ProfilePhotoMimeType } from "@/types/file-upload";

const PRIVATE_BUCKET = "candidate-intake-private";
const PHOTO_MIME: Record<ProfilePhotoFileExtension, ProfilePhotoMimeType> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};
type PhotoReference = PrivateFileReference<ProfilePhotoMimeType, ProfilePhotoFileExtension>;

/** Strictly validate the profile's current private photo pointer; never accept a browser path. */
export async function loadAdminGccPhotoReference(profileId: string): Promise<PhotoReference | null> {
  await requireApplicationRole("admin");
  const db = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await db.from("candidate_profiles")
    .select("gcc_photo_file_id").eq("id", profileId).is("archived_at", null).maybeSingle();
  if (profileError || !profile?.gcc_photo_file_id) return null;
  const { data: file, error: fileError } = await db.from("file_records")
    .select("id, candidate_profile_id, purpose, original_file_name, stored_file_name, mime_type, file_extension, size_bytes, storage_bucket_name, storage_object_key, access_level, status, uploaded_at")
    .eq("id", profile.gcc_photo_file_id).eq("candidate_profile_id", profileId)
    .eq("purpose", "gcc-profile-photo").eq("status", "available").is("archived_at", null).maybeSingle();
  if (fileError || !file) return null;
  const extension = file.file_extension as ProfilePhotoFileExtension;
  const expectedName = `${file.id}.${extension}`;
  const expectedKey = `${profileId}/gcc-profile-photo/${expectedName}`;
  if (!Object.hasOwn(PHOTO_MIME, extension) || file.mime_type !== PHOTO_MIME[extension] ||
      file.candidate_profile_id !== profileId || file.purpose !== "gcc-profile-photo" ||
      file.status !== "available" || file.access_level !== "private" ||
      file.storage_bucket_name !== PRIVATE_BUCKET || file.stored_file_name !== expectedName ||
      file.storage_object_key !== expectedKey || !Number.isSafeInteger(file.size_bytes) ||
      file.size_bytes <= 0 || file.size_bytes > PHOTO_LIMIT_BYTES || !file.uploaded_at) return null;
  const { data: bucket, error: bucketError } = await db.storage.getBucket(PRIVATE_BUCKET);
  if (bucketError || !bucket || bucket.public) return null;
  return { id: file.id, originalFileName: file.original_file_name,
    storedFileName: expectedName, mimeType: PHOTO_MIME[extension], fileExtension: extension,
    sizeBytes: file.size_bytes, storage: { bucketName: PRIVATE_BUCKET, objectKey: expectedKey },
    accessLevel: "private", uploadedAt: file.uploaded_at };
}

/** Decode, autorotate and center-crop into a portrait PNG; corrupt images are omitted. */
export async function prepareGccPhotoBytes(
  bytes: Uint8Array, mimeType: ProfilePhotoMimeType, extension: ProfilePhotoFileExtension,
): Promise<Uint8Array | null> {
  if (PHOTO_MIME[extension] !== mimeType || bytes.length <= 0 || bytes.length > PHOTO_LIMIT_BYTES ||
      !hasSupportedFileSignature(bytes, extension)) return null;
  try {
    const image = sharp(Buffer.from(bytes), { limitInputPixels: 20_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (metadata.format !== (extension === "jpg" ? "jpeg" : extension) ||
        !metadata.width || !metadata.height || metadata.pages !== undefined && metadata.pages > 1) return null;
    return new Uint8Array(await image.rotate().resize(240, 300, { fit: "cover", position: "centre" }).png().toBuffer());
  } catch { return null; }
}

/** Returns only in-memory image bytes; the original private object is never exposed or altered. */
export async function loadAdminGccPhoto(profileId: string): Promise<{ reference: PhotoReference; png: Uint8Array } | null> {
  const reference = await loadAdminGccPhotoReference(profileId);
  if (!reference) return null;
  const db = createSupabaseAdminClient();
  const { data: object, error } = await db.storage.from(PRIVATE_BUCKET).download(reference.storage.objectKey);
  if (error || !object) return null;
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.length !== reference.sizeBytes) return null;
  const png = await prepareGccPhotoBytes(bytes, reference.mimeType, reference.fileExtension);
  return png ? { reference, png } : null;
}
