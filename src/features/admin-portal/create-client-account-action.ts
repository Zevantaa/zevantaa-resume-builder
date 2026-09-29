"use server";

import type { ClientAccountFormState } from "./client-account-types";
import { provisionClientAccount } from "./client-account-service";
import { validateAdminProfile } from "./admin-profile-validation";
import { createWelcomeMessage, getClientPortalUrl } from "./welcome-message";

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

function generateTemporaryPassword() {
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%&*+-=?";
  const all = lowercase + uppercase + digits + symbols;
  const random = new Uint32Array(20);
  crypto.getRandomValues(random);

  const password = [
    lowercase[random[0] % lowercase.length],
    uppercase[random[1] % uppercase.length],
    digits[random[2] % digits.length],
    symbols[random[3] % symbols.length],
    ...Array.from(random.slice(4), (value) => all[value % all.length]),
  ];

  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = random[index] % (index + 1);
    [password[index], password[swapIndex]] = [
      password[swapIndex],
      password[index],
    ];
  }

  return password.join("");
}

const errorMessages = {
  "auth-creation": "The authentication account could not be created. Try again.",
  "duplicate-email": "An account already exists for this email address.",
  "duplicate-profile": "This candidate profile already has a client account.",
  "invalid-package": "Select a valid active Zevantaa package.",
  "profile-update": "The candidate profile could not be updated. The new Auth user was removed.",
  "reconciliation-required": "Provisioning could not be fully rolled back. Review the linked profile and Auth user before retrying.",
  linkage: "The account could not be linked. The new Auth user was removed safely.",
  "linkage-cleanup":
    "Account linkage failed and cleanup could not be confirmed. Review Supabase Auth before retrying.",
  "missing-candidate": "The selected candidate profile is unavailable.",
} as const;

export async function createClientAccountAction(
  _previousState: ClientAccountFormState,
  formData: FormData,
): Promise<ClientAccountFormState> {
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
  const credentialMode = formData.get("credentialMode");
  const accountStatus = formData.get("accountStatus");
  const suppliedPassword = String(formData.get("temporaryPassword") ?? "");
  const fieldErrors: NonNullable<ClientAccountFormState["fieldErrors"]> = { ...profileErrors };

  if (!candidateProfileId) {
    fieldErrors.candidateProfileId = "Select a candidate profile.";
  }

  if (accountStatus !== "active" && accountStatus !== "disabled") {
    fieldErrors.accountStatus = "Select a valid account status.";
  }

  const temporaryPassword =
    credentialMode === "generated" ? generateTemporaryPassword() : suppliedPassword;

  if (credentialMode !== "generated" && credentialMode !== "manual") {
    fieldErrors.temporaryPassword = "Choose a credential option.";
  } else if (!PASSWORD_PATTERN.test(temporaryPassword)) {
    fieldErrors.temporaryPassword =
      "Use at least 12 characters with uppercase, lowercase, number and symbol.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "error" };
  }
  const portalUrl = getClientPortalUrl();
  if (!portalUrl) {
    return { message: "Configure NEXT_PUBLIC_APP_URL before provisioning client credentials.", status: "error" };
  }

  let result;

  try {
    result = await provisionClientAccount({
      accountStatus: accountStatus as "active" | "disabled",
      candidateProfileId,
      profile,
      temporaryPassword,
    });
  } catch {
    return {
      message: "Client provisioning is temporarily unavailable. Check the server configuration and try again.",
      status: "error",
    };
  }

  if (!result.ok) {
    return { message: errorMessages[result.code], status: "error" };
  }

  return {
    credentials: {
      email: profile.email,
      temporaryPassword,
      ...createWelcomeMessage(profile, temporaryPassword, portalUrl, result.packageName, accountStatus as "active" | "disabled"),
    },
    message: "Client account created and linked successfully.",
    status: "success",
  };
}
