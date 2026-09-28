import "server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FilePurpose } from "@/types/file-upload";

import { resolveLinkedClientProfile } from "./contact-profile-service";
import { IntakeFileValidationError, validateIntakeFile } from "./intake-file-validation";
import type { NormalizedContactProfile } from "./contact-profile-validation";
import type { NormalizedProfileDetails } from "./profile-details-validation";

const INTAKE_BUCKET = "candidate-intake-private";

type CurrentFile = { originalFileName: string; status: string };
export type ClientIntakeFiles = { resume: CurrentFile | null; photo: CurrentFile | null };

type FileRow = {
  id: string;
  candidate_profile_id: string;
  purpose: FilePurpose;
  original_file_name: string;
  status: string;
  version_number: number;
};

async function loadCurrentFile(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  profileId: string,
  fileId: string | null,
  purpose: FilePurpose,
): Promise<FileRow | null> {
  if (!fileId) return null;
  const { data, error } = await supabase
    .from("file_records")
    .select("id, candidate_profile_id, purpose, original_file_name, status, version_number")
    .eq("id", fileId)
    .eq("candidate_profile_id", profileId)
    .eq("purpose", purpose)
    .maybeSingle();
  if (error || !data) throw new Error("The current file record is unavailable.");
  return data as FileRow;
}

export async function getClientIntakeFiles(): Promise<ClientIntakeFiles | null> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;
  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select("existing_resume_file_id, gcc_photo_file_id")
    .eq("id", linked.profileId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("The intake files could not be loaded.");
  if (!profile) return null;
  const [resume, photo] = await Promise.all([
    loadCurrentFile(supabase, linked.profileId, profile.existing_resume_file_id, "source-resume"),
    loadCurrentFile(supabase, linked.profileId, profile.gcc_photo_file_id, "gcc-profile-photo"),
  ]);
  const display = (row: FileRow | null): CurrentFile | null => row && ({
    originalFileName: row.original_file_name,
    status: row.status,
  });
  return { resume: display(resume), photo: display(photo) };
}

export type IntakeSaveValues = {
  contact: NormalizedContactProfile;
  details: NormalizedProfileDetails;
  resume: File | null;
  photo: File | null;
};

export async function saveClientIntake(values: IntakeSaveValues): Promise<"saved" | "saved-with-warning" | "missing"> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return "missing";
  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("candidate_profiles")
    .select("id, existing_resume_file_id, gcc_photo_file_id")
    .eq("id", linked.profileId)
    .is("archived_at", null)
    .maybeSingle();
  if (profileError) throw new Error("The linked profile could not be loaded.");
  if (!profile) return "missing";

  const [oldResume, oldPhoto] = await Promise.all([
    loadCurrentFile(supabase, linked.profileId, profile.existing_resume_file_id, "source-resume"),
    loadCurrentFile(supabase, linked.profileId, profile.gcc_photo_file_id, "gcc-profile-photo"),
  ]);
  if ((!oldResume || oldResume.status !== "available") && !values.resume) {
    throw new IntakeFileValidationError("Upload a source resume to continue.", "resume");
  }
  if (!oldResume) throw new Error("The linked source resume record is unavailable.");

  // Validate all supplied bytes before writing anything to Storage or Postgres.
  const [resumeUpload, photoUpload] = await Promise.all([
    values.resume ? validateIntakeFile(values.resume, "source-resume") : null,
    values.photo ? validateIntakeFile(values.photo, "gcc-profile-photo") : null,
  ]);
  const created: { id: string; key: string }[] = [];

  async function store(
    upload: NonNullable<typeof resumeUpload>,
    prior: FileRow | null,
  ): Promise<string> {
    const id = randomUUID();
    // Object keys contain only a server-resolved profile UUID and generated UUID.
    const storedName = `${id}.${upload.metadata.extension}`;
    const key = `${linked!.profileId}/${upload.metadata.purpose}/${storedName}`;
    const { error: storageError } = await supabase.storage
      .from(INTAKE_BUCKET)
      .upload(key, upload.bytes, {
        contentType: upload.metadata.mimeType,
        upsert: false,
      });
    if (storageError) throw new Error("The private file upload failed.");
    created.push({ id, key });
    const now = new Date().toISOString();
    const { error: recordError } = await supabase.from("file_records").insert({
      id,
      candidate_profile_id: linked!.profileId,
      purpose: upload.metadata.purpose,
      original_file_name: upload.metadata.originalFileName,
      stored_file_name: storedName,
      mime_type: upload.metadata.mimeType,
      file_extension: upload.metadata.extension,
      size_bytes: upload.metadata.sizeBytes,
      storage_bucket_name: INTAKE_BUCKET,
      storage_object_key: key,
      access_level: "private",
      status: "available",
      version_number: prior ? prior.version_number + 1 : 1,
      replaces_file_id: prior?.id ?? null,
      uploaded_at: now,
      created_by_user_id: linked!.userId,
      updated_by_user_id: linked!.userId,
    });
    if (recordError) throw new Error("The file metadata could not be saved.");
    return id;
  }

  try {
    const resumeId = resumeUpload ? await store(resumeUpload, oldResume) : oldResume!.id;
    const photoId = photoUpload ? await store(photoUpload, oldPhoto) : oldPhoto?.id ?? null;
    let update = supabase
      .from("candidate_profiles")
      .update({
        full_name: values.contact.fullName,
        primary_email: values.contact.primaryEmail,
        mobile_number: values.contact.mobileNumber,
        whatsapp_number: values.contact.whatsappNumber,
        linkedin_url: values.details.linkedinUrl,
        current_location: values.details.currentLocation,
        relocation_preference: values.details.relocationPreference,
        existing_resume_file_id: resumeId,
        gcc_photo_file_id: photoId,
        updated_at: new Date().toISOString(),
        updated_by_user_id: linked.userId,
      })
      .eq("id", linked.profileId)
      .eq("existing_resume_file_id", oldResume!.id)
      .is("archived_at", null);
    update = oldPhoto ? update.eq("gcc_photo_file_id", oldPhoto.id) : update.is("gcc_photo_file_id", null);
    const { data: saved, error: saveError } = await update.select("id").maybeSingle();
    if (saveError || !saved) throw new Error("The intake could not be saved. Reload and try again.");
  } catch (error) {
    // Nothing points at the new records until the final profile update succeeds.
    // Compensate failed saves without touching historical files.
    for (const item of created.reverse()) {
      await supabase.from("file_records").delete().eq("id", item.id).eq("candidate_profile_id", linked.profileId);
      await supabase.storage.from(INTAKE_BUCKET).remove([item.key]);
    }
    throw error;
  }

  // Historical records and objects remain private and available for audit.
  let historyUpdateFailed = false;
  for (const prior of [resumeUpload ? oldResume : null, photoUpload ? oldPhoto : null]) {
    if (prior) {
      const { error } = await supabase.from("file_records").update({
        status: "replaced",
        updated_at: new Date().toISOString(),
        updated_by_user_id: linked.userId,
      }).eq("id", prior.id).eq("candidate_profile_id", linked.profileId);
      if (error) historyUpdateFailed = true;
    }
  }
  return historyUpdateFailed ? "saved-with-warning" : "saved";
}
