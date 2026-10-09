"use server";

import { cookies } from "next/headers";

import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    throw new Error("We could not update your password. Request a new link and try again.");
  }

  cookieStore.set(RECOVERY_COOKIE_NAME, "", {
    ...RECOVERY_COOKIE_OPTIONS,
    maxAge: 0,
  });
  await supabase.auth.signOut({ scope: "local" });
}
