"use server";

import { revalidatePath } from "next/cache";

import { retryClientInvitation } from "./client-account-service";

export type InvitationRetryState = { status: "idle" | "success" | "error"; message?: string };

export async function retryClientInvitationAction(
  _previous: InvitationRetryState,
  formData: FormData,
): Promise<InvitationRetryState> {
  const invitationId = String(formData.get("invitationId") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(invitationId)) {
    return { status: "error", message: "The invitation could not be verified." };
  }
  try {
    const result = await retryClientInvitation(invitationId);
    if (!result.ok) {
      return { status: "error", message: result.code === "invitation-delivery"
        ? "The setup email was not accepted for delivery. Check email configuration and retry."
        : "The invitation is no longer eligible for a new setup email. Refresh and review its state." };
    }
    revalidatePath("/admin/workflow");
    return { status: "success", message: "A new secure setup email was accepted for delivery." };
  } catch {
    return { status: "error", message: "The setup email could not be sent. Try again shortly." };
  }
}
