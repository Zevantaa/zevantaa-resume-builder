"use server";

import { generateClientPasswordSetupLink } from "./client-account-service";

export type ClientAccessLinkState = {
  status: "idle" | "success" | "error";
  message?: string;
  setupLink?: string;
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
