import "server-only";

import { cookies } from "next/headers";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { isValidRecoveryProof, RECOVERY_COOKIE_NAME } from "./recovery-proof";

export async function hasVerifiedRecoverySession() {
  if (!isSupabaseConfigured()) return false;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;
    const proof = (await cookies()).get(RECOVERY_COOKIE_NAME)?.value;
    return isValidRecoveryProof(proof, data.user.id);
  } catch {
    return false;
  }
}
