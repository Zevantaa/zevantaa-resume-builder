"use server";

import { revalidatePath } from "next/cache";

import type {
  ClientAccountStatus,
  EditClientAccountFormState,
} from "./client-account-types";
import { updateClientAccount } from "./client-account-service";
import { validateAdminProfile } from "./admin-profile-validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errorMessages = {
  "auth-update": "The sign-in email could not be updated. Try again.",
  "confirmation-required": "Confirm that client access should be disabled.",
  "duplicate-email": "That email is already assigned to another account or candidate.",
  "invalid-package": "Select a valid active Zevantaa package.",
  "not-found": "The linked client account could not be found.",
  "profile-update": "The linked candidate profile could not be updated.",
  "reconciliation-required":
    "The update could not be completed or fully rolled back. Review the Auth user and linked profile before retrying.",
  "role-update": "Account status could not be updated. Earlier changes were rolled back.",
} as const;

export async function editClientAccountAction(
  previousState: EditClientAccountFormState,
  formData: FormData,
): Promise<EditClientAccountFormState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const { errors: profileErrors, values: profile } = validateAdminProfile({
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    mobileNumber: String(formData.get("mobileNumber") ?? ""),
    whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    currentLocation: String(formData.get("currentLocation") ?? ""),
    relocationPreference: String(formData.get("relocationPreference") ?? ""),
    packageCode: String(formData.get("packageCode") ?? ""),
  });
  const rawAccountStatus = formData.get("accountStatus");
  const fieldErrors: NonNullable<EditClientAccountFormState["fieldErrors"]> = { ...profileErrors };

  if (!UUID_PATTERN.test(userId)) {
    return { message: errorMessages["not-found"], status: "error" };
  }

  if (rawAccountStatus !== "active" && rawAccountStatus !== "disabled") {
    fieldErrors.accountStatus = "Select a valid account status.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "error" };
  }

  const accountStatus = rawAccountStatus as ClientAccountStatus;

  try {
    const result = await updateClientAccount({
      accountStatus,
      confirmDeactivation: formData.get("confirmDeactivation") === "on",
      profile,
      userId,
    });

    if (!result.ok) {
      return {
        fieldErrors:
          result.code === "confirmation-required"
            ? { confirmation: errorMessages[result.code] }
            : undefined,
        message: errorMessages[result.code],
        status: "error",
      };
    }

    revalidatePath(`/admin/clients/${userId}/edit`);
    revalidatePath("/admin/clients");
    revalidatePath("/admin");
    revalidatePath("/client");

    return {
      message:
        accountStatus === "disabled"
          ? "Client account updated. Portal access is now disabled; no data was deleted."
          : "Client account updated successfully.",
      status: "success",
      saveRevision: (previousState.saveRevision ?? 0) + 1,
    };
  } catch {
    return {
      message: "Client account administration is temporarily unavailable. Try again.",
      status: "error",
    };
  }
}
