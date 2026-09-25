import "server-only";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  CandidateAccountOption,
  ClientAccountStatus,
} from "./client-account-types";

type ProvisionClientAccountInput = {
  accountStatus: ClientAccountStatus;
  candidateProfileId: string;
  email: string;
  temporaryPassword: string;
};

export type ProvisionClientAccountResult =
  | { ok: true }
  | {
      code:
        | "duplicate-email"
        | "duplicate-profile"
        | "email-mismatch"
        | "missing-candidate"
        | "auth-creation"
        | "linkage"
        | "linkage-cleanup";
      ok: false;
    };

export async function listEligibleCandidateProfiles(): Promise<
  CandidateAccountOption[]
> {
  await requireApplicationRole("admin");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("id, full_name, primary_email")
    .is("archived_at", null)
    .order("full_name");

  if (error) {
    throw new Error("Candidate profiles could not be loaded.");
  }

  return (data ?? []).map((profile) => ({
    email: profile.primary_email,
    id: profile.id,
    name: profile.full_name,
  }));
}

export async function provisionClientAccount({
  accountStatus,
  candidateProfileId,
  email,
  temporaryPassword,
}: ProvisionClientAccountInput): Promise<ProvisionClientAccountResult> {
  await requireApplicationRole("admin");
  const supabase = createSupabaseAdminClient();

  const { data: candidate, error: candidateError } = await supabase
    .from("candidate_profiles")
    .select("id, primary_email")
    .eq("id", candidateProfileId)
    .is("archived_at", null)
    .maybeSingle();

  if (candidateError || !candidate) {
    return { code: "missing-candidate", ok: false };
  }

  if (candidate.primary_email.trim().toLowerCase() !== email) {
    return { code: "email-mismatch", ok: false };
  }

  const { data: existingLink, error: linkLookupError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("candidate_profile_id", candidateProfileId)
    .maybeSingle();

  if (linkLookupError) {
    return { code: "linkage", ok: false };
  }

  if (existingLink) {
    return { code: "duplicate-profile", ok: false };
  }

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: temporaryPassword,
    });

  if (authError || !authData.user) {
    if (
      authError?.code === "email_exists" ||
      authError?.code === "user_already_exists"
    ) {
      return { code: "duplicate-email", ok: false };
    }

    return { code: "auth-creation", ok: false };
  }

  const { error: roleError } = await supabase.from("user_roles").insert({
    account_status: accountStatus,
    candidate_profile_id: candidateProfileId,
    role_code: "client",
    user_id: authData.user.id,
  });

  if (!roleError) {
    return { ok: true };
  }

  const { error: cleanupError } = await supabase.auth.admin.deleteUser(
    authData.user.id,
  );

  return {
    code: cleanupError ? "linkage-cleanup" : "linkage",
    ok: false,
  };
}
