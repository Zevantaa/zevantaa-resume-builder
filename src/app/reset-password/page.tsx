import {
  getAuthPortalIntent,
  ResetPasswordExperience,
} from "@/features/authentication";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function hasVerifiedRecoverySession() {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getClaims();

    return !error && Boolean(data?.claims?.sub);
  } catch {
    return false;
  }
}

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { error, portal } = await searchParams;
  const canResetPassword = await hasVerifiedRecoverySession();

  return (
    <ResetPasswordExperience
      canResetPassword={canResetPassword}
      initialError={typeof error === "string" ? error : undefined}
      portal={getAuthPortalIntent(portal)}
    />
  );
}
