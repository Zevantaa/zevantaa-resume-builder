"use server";

import { generateClientPasswordSetupLink, reissueClientTemporaryPassword } from "./client-account-service";

export type ClientAccessLinkState = {
  status: "idle" | "success" | "error";
  message?: string;
  setupLink?: string;
  temporaryPassword?: string;
};

export async function generateClientAccessLinkAction(
  _previous: ClientAccessLinkState, formData: FormData,
): Promise<ClientAccessLinkState> {
  const userId = String(formData.get("userId") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(userId)) {
    return { status: "error", message: "The client account could not be verified." };
  }
  try {
    return { status: "success", setupLink: await generateClientPasswordSetupLink(userId),
      message: "Secure setup link generated. Copy it now; it is not stored by Zevantaa ATS." };
  } catch {
    return { status: "error", message: "A secure setup link could not be generated. Verify the account and Auth configuration." };
  }
}

export async function reissueClientTemporaryPasswordAction(
  _previous: ClientAccessLinkState, formData: FormData,
): Promise<ClientAccessLinkState> {
  const userId = String(formData.get("userId") ?? "").trim();
  const confirmed = formData.get("confirmReissue") === "yes";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(userId) || !confirmed) {
    return { status: "error", message: "Confirm the client account before replacing its credential." };
  }
  try {
    return { status: "success", temporaryPassword: await reissueClientTemporaryPassword(userId),
      message: "Temporary password replaced. Copy it now; it is not stored by Zevantaa ATS." };
  } catch {
    return { status: "error", message: "A temporary password could not be issued. Verify the active client account." };
  }
}
