"use server";

import type { ClientAccountFormState } from "./client-account-types";
import { provisionClientAccount } from "./client-account-service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  "email-mismatch": "The email must match the selected candidate profile.",
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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const credentialMode = formData.get("credentialMode");
  const accountStatus = formData.get("accountStatus");
  const suppliedPassword = String(formData.get("temporaryPassword") ?? "");
  const fieldErrors: NonNullable<ClientAccountFormState["fieldErrors"]> = {};

  if (!candidateProfileId) {
    fieldErrors.candidateProfileId = "Select a candidate profile.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
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

  let result;

  try {
    result = await provisionClientAccount({
      accountStatus: accountStatus === "disabled" ? "disabled" : "active",
      candidateProfileId,
      email,
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
    credentials: { email, temporaryPassword },
    message: "Client account created and linked successfully.",
    status: "success",
  };
}
