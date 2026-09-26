"use server";

import type {
  ClientAccountStatus,
  EditClientAccountFormState,
} from "./client-account-types";
import { updateClientAccount } from "./client-account-service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  _previousState: EditClientAccountFormState,
  formData: FormData,
): Promise<EditClientAccountFormState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const packageCode = String(formData.get("packageCode") ?? "").trim();
  const rawAccountStatus = formData.get("accountStatus");
  const accountStatus: ClientAccountStatus =
    rawAccountStatus === "disabled" ? "disabled" : "active";
  const fieldErrors: NonNullable<EditClientAccountFormState["fieldErrors"]> = {};

  if (!UUID_PATTERN.test(userId)) {
    return { message: errorMessages["not-found"], status: "error" };
  }

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!packageCode) {
    fieldErrors.packageCode = "Select a package.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "error" };
  }

  try {
    const result = await updateClientAccount({
      accountStatus,
      confirmDeactivation: formData.get("confirmDeactivation") === "on",
      email,
      packageCode,
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

    return {
      message:
        accountStatus === "disabled"
          ? "Client account updated. Portal access is now disabled; no data was deleted."
          : "Client account updated successfully.",
      status: "success",
    };
  } catch {
    return {
      message: "Client account administration is temporarily unavailable. Try again.",
      status: "error",
    };
  }
}
