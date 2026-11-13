"use server";

import type { ClientAccountFormState } from "./client-account-types";
import { provisionClientAccount, retryClientInvitation } from "./client-account-service";
import { validateAdminProfile } from "./admin-profile-validation";

const errorMessages = {
  "auth-creation": "The secure invitation could not be created. Try again.",
  "duplicate-email": "An account already exists for this email address.",
  "duplicate-profile": "This candidate profile already has a client account.",
  "invalid-package": "Select a valid active Zevantaa package.",
  "profile-update": "The candidate profile could not be updated. The new Auth user was removed.",
  "reconciliation-required": "Provisioning could not be fully rolled back. Review the linked profile and Auth user before retrying.",
  linkage: "The account could not be linked. The new Auth user was removed safely.",
  "linkage-cleanup":
    "Account linkage failed and cleanup could not be confirmed. Review Supabase Auth before retrying.",
  "missing-candidate": "The selected candidate profile is unavailable.",
  "invitation-delivery": "The account setup was saved, but invitation delivery failed. Check transactional email configuration, then retry safely.",
  "invitation-state": "The invitation state changed or already succeeded. Refresh the page before trying again.",
} as const;

export async function createClientAccountAction(
  _previousState: ClientAccountFormState,
  formData: FormData,
): Promise<ClientAccountFormState> {
  const retryInvitationId = String(formData.get("retryInvitationId") ?? "").trim();
  if (retryInvitationId) {
    try {
      const retried = await retryClientInvitation(retryInvitationId);
      if (!retried.ok) {
        return {
          invitation: retried.invitationId ? {
            email: retried.email ?? "",
            deliveryStatus: "failed",
            invitationId: retried.invitationId,
          } : undefined,
          message: errorMessages[retried.code],
          status: "error",
        };
      }
      return {
        invitation: { email: retried.email, deliveryStatus: "sent", invitationId: retried.invitationId },
        message: "Client invitation sent successfully.",
        status: "success",
      };
    } catch {
      return { message: "Invitation retry is temporarily unavailable.", status: "error" };
    }
  }
  const candidateProfileId = String(formData.get("candidateProfileId") ?? "").trim();
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
  const accountStatus = formData.get("accountStatus");
  const fieldErrors: NonNullable<ClientAccountFormState["fieldErrors"]> = { ...profileErrors };

  if (!candidateProfileId) {
    fieldErrors.candidateProfileId = "Select a candidate profile.";
  }

  if (accountStatus !== "active" && accountStatus !== "disabled") {
    fieldErrors.accountStatus = "Select a valid account status.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "error" };
  }
  let result;

  try {
    result = await provisionClientAccount({
      accountStatus: accountStatus as "active" | "disabled",
      candidateProfileId,
      profile,
    });
  } catch {
    return {
      message: "Client provisioning is temporarily unavailable. Check the server configuration and try again.",
      status: "error",
    };
  }

  if (!result.ok) {
    return {
      invitation: result.invitationId ? {
        email: profile.email,
        deliveryStatus: "failed",
        invitationId: result.invitationId,
      } : undefined,
      message: errorMessages[result.code],
      status: "error",
    };
  }

  return {
    invitation: {
      email: profile.email,
      deliveryStatus: "sent",
      invitationId: result.invitationId,
    },
    message: "Client account created and secure invitation sent.",
    status: "success",
  };
}
