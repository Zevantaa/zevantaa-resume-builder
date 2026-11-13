"use server";

import { requireApplicationRole } from "./authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ChangeTemporaryPasswordState = { ok: boolean; message: string };

function validPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) &&
    /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export async function changeTemporaryPasswordAction(
  _previous: ChangeTemporaryPasswordState,
  formData: FormData,
): Promise<ChangeTemporaryPasswordState> {
  const actor = await requireApplicationRole("client");
  if (!actor.mustChangePassword || !actor.userId) {
    return { ok: false, message: "This account does not require a temporary-password change." };
  }
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!validPassword(password)) {
    return { ok: false, message: "Use 12–128 characters including upper- and lowercase letters, a number, and a symbol." };
  }
  if (password !== confirmation) return { ok: false, message: "The passwords do not match." };
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("password-update", actor.userId, 5);
  }
  const admin = createSupabaseAdminClient();
  const current = await admin.auth.admin.getUserById(actor.userId);
  if (current.error || !current.data.user || current.data.user.app_metadata?.must_change_password !== true) {
    return { ok: false, message: "The temporary credential state changed. Sign in again before retrying." };
  }
  const { error } = await admin.auth.admin.updateUserById(actor.userId, {
    password,
    app_metadata: { ...current.data.user.app_metadata, must_change_password: false },
  });
  if (error) return { ok: false, message: "The password could not be updated. Try again or contact Zevantaa support." };
  await admin.from("client_onboarding_invitations").update({
    accepted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("auth_user_id", actor.userId).is("accepted_at", null);
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/audit-events")).recordSecurityEvent({
      eventType: "recovery.password.updated", actorUserId: actor.userId, outcome: "success",
    });
  }
  return { ok: true, message: "Password updated. Your client workspace is ready." };
}
