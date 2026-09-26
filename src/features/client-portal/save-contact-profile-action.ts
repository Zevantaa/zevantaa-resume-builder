"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";

import { validateContactProfile } from "./contact-profile-validation";
import { saveClientContactProfile } from "./contact-profile-service";
import type { ContactProfileActionState } from "./contact-profile-types";

export async function saveContactProfileAction(
  _previousState: ContactProfileActionState,
  formData: FormData,
): Promise<ContactProfileActionState> {
  // Server Actions are callable independently of the route that renders them.
  await requireApplicationRole("client");

  const { errors, values } = validateContactProfile({
    fullName: String(formData.get("fullName") ?? ""),
    primaryEmail: String(formData.get("primaryEmail") ?? ""),
    mobileNumber: String(formData.get("mobileNumber") ?? ""),
    whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
    sameAsMobile: formData.get("sameAsMobile") === "on",
  });

  if (Object.keys(errors).length > 0) {
    return { errors, status: "error" };
  }

  try {
    const result = await saveClientContactProfile(values);

    if (result === "missing") {
      return {
        message: "Your linked profile is unavailable. Please contact Zevantaa support.",
        status: "error",
      };
    }

    return {
      message: "Contact details saved.",
      savedValues: {
        ...values,
        whatsappNumber: values.whatsappNumber ?? "",
      },
      status: "success",
    };
  } catch {
    return {
      message: "We could not save your contact details. Please try again.",
      status: "error",
    };
  }
}
