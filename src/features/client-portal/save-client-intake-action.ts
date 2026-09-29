"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { revalidatePath } from "next/cache";

import { saveClientIntake } from "./client-intake-service";
import type { IntakeActionState } from "./client-intake-types";
import { IntakeFileValidationError, validateIntakeFileMetadata } from "./intake-file-validation";

function selectedFile(value: FormDataEntryValue | null): File | null {
  if (value === null) return null;
  if (!(value instanceof File)) throw new IntakeFileValidationError("Choose a valid file.");
  return value.name === "" && value.size === 0 ? null : value;
}

export async function saveClientIntakeAction(
  _previous: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  await requireApplicationRole("client");

  if ([
    "profileId", "candidateProfileId", "candidate_profile_id",
    "fullName", "full_name", "primaryEmail", "primary_email", "email",
    "mobileNumber", "mobile_number", "whatsappNumber", "whatsapp_number", "sameAsMobile",
    "linkedinUrl", "linkedin_url", "currentLocation", "current_location",
    "relocationPreference", "relocation_preference",
    "packageCode", "selectedPackage", "selectedPackageCode", "selected_package_code",
    "targetMarkets", "target_markets",
  ].some((key) => formData.has(key))) {
    return { status: "error", message: "Profile identity and administratively managed details cannot be changed here." };
  }

  const errors: Record<string, string> = {};
  let resume: File | null = null;
  let photo: File | null = null;
  try {
    resume = selectedFile(formData.get("resume"));
    if (resume) validateIntakeFileMetadata(resume, "source-resume");
  } catch (error) {
    errors.resume = error instanceof IntakeFileValidationError ? error.message : "Choose a valid resume.";
  }
  try {
    photo = selectedFile(formData.get("photo"));
    if (photo) validateIntakeFileMetadata(photo, "gcc-profile-photo");
  } catch (error) {
    errors.photo = error instanceof IntakeFileValidationError ? error.message : "Choose a valid photograph.";
  }
  if (!resume && !photo && Object.keys(errors).length === 0) {
    errors.resume = "Choose a resume or photograph to upload.";
  }
  if (Object.keys(errors).length) return { status: "error", errors, message: "Review the highlighted fields and try again." };

  try {
    const result = await saveClientIntake({
      resume,
      photo,
    });
    if (result === "missing") {
      return { status: "error", message: "Your linked profile is unavailable. Contact Zevantaa support." };
    }
    revalidatePath("/client/profile");
    if (result === "saved-with-warning") {
      return { status: "warning", savedAt: Date.now(), message: "Your intake was saved, but a previous file's history status could not be updated. Contact Zevantaa support if the file list looks incorrect." };
    }
    return { status: "success", savedAt: Date.now(), message: "Your selected files were saved. No document processing has started." };
  } catch (error) {
    if (error instanceof IntakeFileValidationError && error.field) {
      return { status: "error", errors: { [error.field]: error.message }, message: "Review the highlighted file and try again." };
    }
    return {
      status: "error",
      message: error instanceof IntakeFileValidationError
        ? error.message
        : "We could not save your intake. Your previous files remain unchanged. Please try again.",
    };
  }
}
