"use server";

import { revalidatePath } from "next/cache";

import { archiveClientAccount, permanentlyDeleteClient, restoreClientAccount } from "./client-lifecycle-service";

export type ClientLifecycleState = { status: "idle" | "success" | "warning" | "error"; message?: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function archiveClientAction(_previous: ClientLifecycleState, formData: FormData): Promise<ClientLifecycleState> {
  const profileId = String(formData.get("profileId") ?? "");
  const email = String(formData.get("confirmationEmail") ?? "");
  if (!uuid.test(profileId) || !email) return { status: "error", message: "Enter the client email exactly to confirm." };
  const result = await archiveClientAccount(profileId, email);
  if (!result.ok) return result.code === "auth-sync" && result.archived
    ? { status: "warning", message: "The client was archived and application access was disabled, but Auth suspension requires an administrator retry." }
    : { status: "error", message: result.code === "confirmation" ? "The confirmation email does not match this client." : "The client could not be archived." };
  revalidatePath("/admin/clients"); revalidatePath("/admin/clients/archived");
  return { status: "success", message: `Client archived. Recovery is available until ${new Date(result.recoveryUntil).toLocaleString("en-IN")}.` };
}

export async function restoreClientAction(_previous: ClientLifecycleState, formData: FormData): Promise<ClientLifecycleState> {
  const profileId = String(formData.get("profileId") ?? "");
  if (!uuid.test(profileId)) return { status: "error", message: "The archived client could not be verified." };
  const result = await restoreClientAccount(profileId);
  if (!result.ok) return { status: "error", message: "The client could not be restored. Verify the recovery period and Auth state." };
  revalidatePath("/admin/clients"); revalidatePath("/admin/clients/archived");
  return { status: "success", message: "Client access and recoverable processing state were restored." };
}

export async function permanentlyDeleteClientAction(_previous: ClientLifecycleState, formData: FormData): Promise<ClientLifecycleState> {
  const profileId = String(formData.get("profileId") ?? "");
  const email = String(formData.get("confirmationEmail") ?? "");
  if (!uuid.test(profileId) || !email) return { status: "error", message: "The permanent-deletion confirmation is invalid." };
  const result = await permanentlyDeleteClient(profileId, email);
  if (!result.ok) return { status: "error", message: result.code === "disabled"
    ? "Permanent deletion remains disabled until its production lifecycle is explicitly verified."
    : "Permanent deletion stopped safely. Review the lifecycle error state before retrying." };
  revalidatePath("/admin/clients/archived");
  return { status: result.authCleanupPending ? "warning" : "success", message: result.authCleanupPending
    ? "Candidate data and private objects were deleted; final Auth cleanup remains pending."
    : "The archived client and associated private data were permanently deleted." };
}
