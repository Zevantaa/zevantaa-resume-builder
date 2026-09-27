"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";

import { saveClientProfileDetails } from "./profile-details-service";
import type { ProfileDetailsActionState } from "./profile-details-types";
import { validateProfileDetails } from "./profile-details-validation";

export async function saveProfileDetailsAction(
  _previousState: ProfileDetailsActionState,
  formData: FormData,
): Promise<ProfileDetailsActionState> {
  // A Server Action can be invoked without rendering its protected page first.
  await requireApplicationRole("client");

  if (
    formData.has("packageCode") ||
    formData.has("selectedPackage") ||
    formData.has("selectedPackageCode") ||
    formData.has("selected_package_code") ||
    formData.has("targetMarkets") ||
    formData.has("target_markets")
  ) {
    return {
      message: "Package and target-market changes are managed by Zevantaa administrators.",
      status: "error",
    };
  }

  const { errors, values } = validateProfileDetails({
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    currentLocation: String(formData.get("currentLocation") ?? ""),
    relocationPreference: String(formData.get("relocationPreference") ?? ""),
  });
  if (Object.keys(errors).length) return { errors, status: "error" };

  try {
    if ((await saveClientProfileDetails(values)) === "missing") {
      return {
        message: "Your linked profile is unavailable. Please contact Zevantaa support.",
        status: "error",
      };
    }
    return { message: "Professional link and mobility details saved.", status: "success" };
  } catch {
    return {
      message: "We could not save these details. Please try again.",
      status: "error",
    };
  }
}
