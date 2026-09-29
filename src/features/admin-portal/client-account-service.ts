import "server-only";

import { randomUUID } from "node:crypto";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  CandidateAccountOption,
  AdminProfileFields,
  ClientAccountStatus,
  PackageAssignmentOption,
  ProvisionedClientDetail,
  ProvisionedClientSummary,
} from "./client-account-types";

type ProvisionClientAccountInput = {
  accountStatus: ClientAccountStatus;
  candidateProfileId: string;
  profile: AdminProfileFields;
  temporaryPassword: string;
};

export type ProvisionClientAccountResult =
  | { ok: true; packageName: string }
  | {
      code:
        | "duplicate-email"
        | "duplicate-profile"
        | "invalid-package"
        | "profile-update"
        | "reconciliation-required"
        | "missing-candidate"
        | "auth-creation"
        | "linkage"
        | "linkage-cleanup";
      ok: false;
    };

type UpdateClientAccountInput = {
  accountStatus: ClientAccountStatus;
  confirmDeactivation: boolean;
  profile: AdminProfileFields;
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

function profileValues(profile: AdminProfileFields, targetMarkets: string[]) {
  return {
    full_name: profile.fullName,
    primary_email: profile.email,
    mobile_number: profile.mobileNumber,
    whatsapp_number: profile.whatsappNumber,
    linkedin_url: profile.linkedinUrl,
    current_location: profile.currentLocation,
    relocation_preference: profile.relocationPreference,
    selected_package_code: profile.packageCode,
    target_markets: targetMarkets,
  };
}

async function emailUsedByAnotherProfile(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  candidateProfileId: string,
  email: string,
): Promise<boolean | null> {
  const { data, error } = await supabase.from("candidate_profiles")
    .select("primary_email")
    .neq("id", candidateProfileId)
    .is("archived_at", null);
  if (error) return null;
  return (data ?? []).some((candidate) => candidate.primary_email.trim().toLowerCase() === email);
}

export async function getPackageOptions(): Promise<PackageAssignmentOption[]> {
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
        .select("full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference, selected_package_code")
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
    mobileNumber: profile.mobile_number,
    whatsappNumber: profile.whatsapp_number ?? "",
    linkedinUrl: profile.linkedin_url ?? "",
    currentLocation: profile.current_location,
    relocationPreference: profile.relocation_preference,
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
    .select("id, full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference, selected_package_code")
    .is("archived_at", null)
    .order("full_name");

  if (error) {
    throw new Error("Candidate profiles could not be loaded.");
  }

  return (data ?? []).map((profile) => ({
    email: profile.primary_email,
    id: profile.id,
    name: profile.full_name,
    mobileNumber: profile.mobile_number,
    whatsappNumber: profile.whatsapp_number ?? "",
    linkedinUrl: profile.linkedin_url ?? "",
    currentLocation: profile.current_location,
    relocationPreference: profile.relocation_preference,
    packageCode: profile.selected_package_code,
  }));
}

export async function provisionClientAccount({
  accountStatus,
  candidateProfileId,
  profile,
  temporaryPassword,
}: ProvisionClientAccountInput): Promise<ProvisionClientAccountResult> {
  const adminContext = await requireApplicationRole("admin");
  const supabase = createSupabaseAdminClient();
  const creatingProfile = candidateProfileId === "new";
  const linkedProfileId = creatingProfile ? randomUUID() : candidateProfileId;
  let candidateSnapshot: Record<string, unknown> | null = null;
  if (!creatingProfile) {
    const { data: candidate, error: candidateError } = await supabase
      .from("candidate_profiles")
      .select("full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference, selected_package_code, target_markets")
      .eq("id", linkedProfileId)
      .is("archived_at", null)
      .maybeSingle();
    if (candidateError || !candidate) return { code: "missing-candidate", ok: false };
    candidateSnapshot = { ...candidate, target_markets: [...candidate.target_markets] };

    const { data: existingLink, error: linkLookupError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("candidate_profile_id", linkedProfileId)
      .maybeSingle();
    if (linkLookupError) return { code: "linkage", ok: false };
    if (existingLink) return { code: "duplicate-profile", ok: false };
  }

  const { data: selectedPackage, error: packageError } = await supabase
    .from("package_definitions")
    .select("code, display_name, target_markets")
    .eq("code", profile.packageCode)
    .eq("is_active", true)
    .is("archived_at", null)
    .maybeSingle();
  if (packageError || !selectedPackage) return { code: "invalid-package", ok: false };

  const duplicate = await emailUsedByAnotherProfile(supabase, linkedProfileId, profile.email);
  if (duplicate === null) return { code: "profile-update", ok: false };
  if (duplicate) return { code: "duplicate-email", ok: false };

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: profile.email,
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

  const profileWrite = creatingProfile
    ? await supabase.from("candidate_profiles").insert({
        id: linkedProfileId,
        ...profileValues(profile, selectedPackage.target_markets),
        existing_resume_file_id: null,
        created_by_user_id: adminContext.userId,
        updated_by_user_id: adminContext.userId,
      })
    : await supabase.from("candidate_profiles")
        .update({
          ...profileValues(profile, selectedPackage.target_markets),
          updated_at: new Date().toISOString(),
          updated_by_user_id: adminContext.userId,
        })
        .eq("id", linkedProfileId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
  if (profileWrite.error || (!creatingProfile && !profileWrite.data)) {
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(authData.user.id);
    return { code: cleanupError ? "reconciliation-required" : "profile-update", ok: false };
  }

  const { error: roleError } = await supabase.from("user_roles").insert({
    account_status: accountStatus,
    candidate_profile_id: linkedProfileId,
    role_code: "client",
    user_id: authData.user.id,
  });

  if (!roleError) {
    return { ok: true, packageName: selectedPackage.display_name };
  }

  const { error: profileRollbackError } = creatingProfile
    ? await supabase.from("candidate_profiles").delete().eq("id", linkedProfileId)
    : await supabase.from("candidate_profiles")
        .update({
          ...candidateSnapshot,
          updated_at: new Date().toISOString(),
          updated_by_user_id: adminContext.userId,
        })
        .eq("id", linkedProfileId);

  const { error: cleanupError } = await supabase.auth.admin.deleteUser(
    authData.user.id,
  );

  return {
    code: profileRollbackError ? "reconciliation-required" : cleanupError ? "linkage-cleanup" : "linkage",
    ok: false,
  };
}

export async function updateClientAccount({
  accountStatus,
  confirmDeactivation,
  profile: changes,
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
      .select("full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference, selected_package_code, target_markets")
      .eq("id", candidateProfileId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("package_definitions")
      .select("code, target_markets")
      .eq("code", changes.packageCode)
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
  const profileSnapshot = {
    ...profile,
    target_markets: [...profile.target_markets],
  };

  const previousEmail = authUser.email.trim().toLowerCase();
  const emailChanged = previousEmail !== changes.email;

  if (emailChanged) {
    const duplicate = await emailUsedByAnotherProfile(supabase, candidateProfileId, changes.email);
    if (duplicate === null) {
      return { code: "profile-update", ok: false };
    }
    if (duplicate) {
      return { code: "duplicate-email", ok: false };
    }

    const { error: authUpdateError } =
      await supabase.auth.admin.updateUserById(userId, {
        email: changes.email,
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
      ...profileValues(changes, selectedPackage.target_markets),
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
      ...profileSnapshot,
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
