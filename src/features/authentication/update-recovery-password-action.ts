"use server";

import { cookies } from "next/headers";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  isValidRecoveryProof,
  RECOVERY_COOKIE_NAME,
  RECOVERY_COOKIE_OPTIONS,
} from "./recovery-proof";

export async function updateRecoveryPasswordAction(password: string) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Use at least 8 characters.");
  }

  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (
    error ||
    !data.user ||
    !isValidRecoveryProof(
      cookieStore.get(RECOVERY_COOKIE_NAME)?.value,
      data.user.id,
    )
  ) {
    throw new Error("This recovery link is invalid or has expired. Request a new link.");
  }

  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("password-update", data.user.id, 5);
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    throw new Error("We could not update your password. Request a new link and try again.");
  }
  // This is a no-op for ordinary recovery users. For invited clients it records
  // genuine activation only after the password was successfully established.
  await createSupabaseAdminClient().from("client_onboarding_invitations").update({
    accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("auth_user_id", data.user.id).eq("delivery_status", "sent").is("accepted_at", null);
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/audit-events")).recordSecurityEvent({
      eventType: "recovery.password.updated", actorUserId: data.user.id, outcome: "success",
    });
  }

  cookieStore.set(RECOVERY_COOKIE_NAME, "", {
    ...RECOVERY_COOKIE_OPTIONS,
    maxAge: 0,
  });
  await supabase.auth.signOut({ scope: "local" });
}
