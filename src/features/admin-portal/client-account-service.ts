import "server-only";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  CandidateAccountOption,
  ClientAccountStatus,
  PackageAssignmentOption,
  ProvisionedClientDetail,
  ProvisionedClientSummary,
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

type UpdateClientAccountInput = {
  accountStatus: ClientAccountStatus;
  confirmDeactivation: boolean;
  email: string;
  packageCode: string;
  userId: string;
};

export type UpdateClientAccountResult =
  | { ok: true }
  | {
      code:
        | "auth-update"
        | "confirmation-required"
        | "duplicate-email"
        | "invalid-package"
        | "not-found"
        | "profile-update"
        | "reconciliation-required"
        | "role-update";
      ok: false;
    };

async function getPackageOptions(): Promise<PackageAssignmentOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("package_definitions")
    .select("code, display_name")
    .eq("is_active", true)
    .is("archived_at", null)
    .order("sort_order");

  if (error) {
    throw new Error("Package definitions could not be loaded.");
  }

  return (data ?? []).map((definition) => ({
    code: definition.code,
    displayName: definition.display_name,
  }));
}

export async function listProvisionedClients(): Promise<
  ProvisionedClientSummary[]
> {
  await requireApplicationRole("admin");
  const supabase = createSupabaseAdminClient();
  const { data: roleRows, error } = await supabase
    .from("user_roles")
    .select(
      "account_status, candidate_profile_id, user_id, candidate_profiles!inner(full_name, selected_package_code, package_definitions!inner(display_name))",
    )
    .eq("role_code", "client")
    .not("candidate_profile_id", "is", null)
    .order("created_at");

  if (error) {
    throw new Error("Provisioned clients could not be loaded.");
  }

  const clients = await Promise.all(
    (roleRows ?? []).map(async (row) => {
      const { data, error: authError } =
        await supabase.auth.admin.getUserById(row.user_id);

      if (authError || !data.user?.email) {
        return null;
      }

      const profile = Array.isArray(row.candidate_profiles)
        ? row.candidate_profiles[0]
        : row.candidate_profiles;
      const packageDefinition = Array.isArray(profile.package_definitions)
        ? profile.package_definitions[0]
        : profile.package_definitions;

      return {
        accountStatus: row.account_status as ClientAccountStatus,
        candidateProfileId: row.candidate_profile_id as string,
        email: data.user.email,
        fullName: profile.full_name,
        packageCode: profile.selected_package_code,
        packageName: packageDefinition.display_name,
        userId: row.user_id,
      } satisfies ProvisionedClientSummary;
    }),
  );

  return clients.filter(
    (client): client is ProvisionedClientSummary => client !== null,
  );
}

export async function getProvisionedClient(
  userId: string,
): Promise<ProvisionedClientDetail | null> {
  await requireApplicationRole("admin");
  const supabase = createSupabaseAdminClient();
  const { data: role, error } = await supabase
    .from("user_roles")
    .select("account_status, candidate_profile_id")
    .eq("user_id", userId)
    .eq("role_code", "client")
    .maybeSingle();

  if (error || !role?.candidate_profile_id) {
    return null;
  }

  const [{ data: profile }, { data: authData, error: authError }, packages] =
    await Promise.all([
      supabase
        .from("candidate_profiles")
        .select("full_name, selected_package_code")
        .eq("id", role.candidate_profile_id)
        .is("archived_at", null)
        .maybeSingle(),
      supabase.auth.admin.getUserById(userId),
      getPackageOptions(),
    ]);

  if (!profile || authError || !authData.user?.email) {
    return null;
  }

  const packageName =
    packages.find(({ code }) => code === profile.selected_package_code)
      ?.displayName ?? profile.selected_package_code;

  return {
    accountStatus: role.account_status as ClientAccountStatus,
    candidateProfileId: role.candidate_profile_id,
    email: authData.user.email,
    fullName: profile.full_name,
    packageCode: profile.selected_package_code,
    packageName,
    packages,
    userId,
  };
}

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

export async function updateClientAccount({
  accountStatus,
  confirmDeactivation,
  email,
  packageCode,
  userId,
}: UpdateClientAccountInput): Promise<UpdateClientAccountResult> {
  const adminContext = await requireApplicationRole("admin");
  const supabase = createSupabaseAdminClient();
  const { data: role, error: roleLookupError } = await supabase
    .from("user_roles")
    .select("account_status, candidate_profile_id")
    .eq("user_id", userId)
    .eq("role_code", "client")
    .maybeSingle();

  if (roleLookupError || !role?.candidate_profile_id) {
    return { code: "not-found", ok: false };
  }

  if (
    role.account_status === "active" &&
    accountStatus === "disabled" &&
    !confirmDeactivation
  ) {
    return { code: "confirmation-required", ok: false };
  }

  const candidateProfileId = role.candidate_profile_id;
  const [profileResult, packageResult, authResult] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select("primary_email, selected_package_code, target_markets")
      .eq("id", candidateProfileId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("package_definitions")
      .select("code, target_markets")
      .eq("code", packageCode)
      .eq("is_active", true)
      .is("archived_at", null)
      .maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);

  const profile = profileResult.data;
  const selectedPackage = packageResult.data;
  const authUser = authResult.data.user;

  if (profileResult.error || authResult.error || !profile || !authUser?.email) {
    return { code: "not-found", ok: false };
  }

  if (packageResult.error || !selectedPackage) {
    return { code: "invalid-package", ok: false };
  }

  const previousEmail = authUser.email.trim().toLowerCase();
  const emailChanged = previousEmail !== email;

  if (emailChanged) {
    const { error: duplicateProfileError, data: otherProfiles } =
      await supabase
        .from("candidate_profiles")
        .select("primary_email")
        .neq("id", candidateProfileId)
        .is("archived_at", null);

    if (duplicateProfileError) {
      return { code: "profile-update", ok: false };
    }

    if (
      (otherProfiles ?? []).some(
        (candidate) => candidate.primary_email.trim().toLowerCase() === email,
      )
    ) {
      return { code: "duplicate-email", ok: false };
    }

    const { error: authUpdateError } =
      await supabase.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      });

    if (authUpdateError) {
      if (
        authUpdateError.code === "email_exists" ||
        authUpdateError.code === "user_already_exists"
      ) {
        return { code: "duplicate-email", ok: false };
      }

      return { code: "auth-update", ok: false };
    }
  }

  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("candidate_profiles")
    .update({
      primary_email: email,
      selected_package_code: selectedPackage.code,
      target_markets: selectedPackage.target_markets,
      updated_at: new Date().toISOString(),
      updated_by_user_id: adminContext.userId,
    })
    .eq("id", candidateProfileId)
    .select("id")
    .maybeSingle();

  if (profileUpdateError || !updatedProfile) {
    if (emailChanged) {
      const { error: rollbackError } =
        await supabase.auth.admin.updateUserById(userId, {
          email: previousEmail,
          email_confirm: true,
        });

      if (rollbackError) {
        return { code: "reconciliation-required", ok: false };
      }
    }

    return { code: "profile-update", ok: false };
  }

  const { data: updatedRole, error: roleUpdateError } = await supabase
    .from("user_roles")
    .update({
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("candidate_profile_id", candidateProfileId)
    .eq("role_code", "client")
    .select("user_id")
    .maybeSingle();

  if (!roleUpdateError && updatedRole) {
    return { ok: true };
  }

  const { error: profileRollbackError } = await supabase
    .from("candidate_profiles")
    .update({
      primary_email: profile.primary_email,
      selected_package_code: profile.selected_package_code,
      target_markets: profile.target_markets,
      updated_at: new Date().toISOString(),
      updated_by_user_id: adminContext.userId,
    })
    .eq("id", candidateProfileId);
  let authRollbackFailed = false;

  if (emailChanged) {
    const { error: authRollbackError } =
      await supabase.auth.admin.updateUserById(userId, {
        email: previousEmail,
        email_confirm: true,
      });
    authRollbackFailed = Boolean(authRollbackError);
  }

  if (profileRollbackError || authRollbackFailed) {
    return { code: "reconciliation-required", ok: false };
  }

  return { code: "role-update", ok: false };
}
