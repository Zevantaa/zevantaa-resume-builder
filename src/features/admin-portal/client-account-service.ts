import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPackageRouting } from "@/features/document-generation/package-routing";
import { getClientInvitationRedirectUrl, getClientPortalUrl, getClientRecoveryRedirectUrl } from "./welcome-message";

import type {
  CandidateAccountOption,
  ClientAccessMethod,
  AdminProfileFields,
  ClientAccountStatus,
  ClientInvitationDeliveryStatus,
  PackageAssignmentOption,
  ProvisionedClientDetail,
  ProvisionedClientSummary,
} from "./client-account-types";

type ProvisionClientAccountInput = {
  accessMethod?: ClientAccessMethod;
  accountStatus: ClientAccountStatus;
  candidateProfileId: string;
  profile: AdminProfileFields;
};

export type ProvisionClientAccountResult =
  | { ok: true; packageName: string; invitationId: string; temporaryPassword?: string }
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
        | "linkage-cleanup"
        | "invitation-delivery"
        | "invitation-state";
      ok: false;
      invitationId?: string;
    };

export type RetryClientInvitationResult =
  | { ok: true; invitationId: string; email: string }
  | { ok: false; code: "auth-creation" | "duplicate-email" | "invitation-delivery" | "invitation-state" | "linkage" | "linkage-cleanup"; invitationId?: string; email?: string };

type UpdateClientAccountInput = {
  accountStatus: ClientAccountStatus;
  confirmDeactivation: boolean;
  profile: AdminProfileFields;
  userId: string;
};

export type UpdateClientAccountResult =
  | { ok: true; packageCode: string }
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

/** 192 random bits plus all required character classes; returned only once. */
function createTemporaryPassword(): string {
  return `Zv!7-${randomBytes(24).toString("base64url")}`;
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
      "account_status, candidate_profile_id, user_id, candidate_profiles!inner(full_name, primary_email, selected_package_code, package_definitions!inner(display_name))",
    )
    .eq("role_code", "client")
    .not("candidate_profile_id", "is", null)
    .order("created_at");

  if (error) {
    throw new Error("Provisioned clients could not be loaded.");
  }

  const clients = (roleRows ?? []).map((row) => {
      const profile = Array.isArray(row.candidate_profiles)
        ? row.candidate_profiles[0]
        : row.candidate_profiles;
      const packageDefinition = Array.isArray(profile.package_definitions)
        ? profile.package_definitions[0]
        : profile.package_definitions;

      return {
        accountStatus: row.account_status as ClientAccountStatus,
        candidateProfileId: row.candidate_profile_id as string,
        email: profile.primary_email,
        fullName: profile.full_name,
        packageCode: profile.selected_package_code,
        packageName: packageDefinition.display_name,
        userId: row.user_id,
      } satisfies ProvisionedClientSummary;
    });

  return clients;
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

  const [{ data: profile }, { data: authData, error: authError }, packages, invitationResult] =
    await Promise.all([
      supabase
        .from("candidate_profiles")
        .select("full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference, selected_package_code")
        .eq("id", role.candidate_profile_id)
        .is("archived_at", null)
        .maybeSingle(),
      supabase.auth.admin.getUserById(userId),
      getPackageOptions(),
      supabase.from("client_onboarding_invitations")
        .select("id, delivery_status, accepted_at, last_attempt_at, sent_at")
        .eq("candidate_profile_id", role.candidate_profile_id).maybeSingle(),
    ]);

  const portalUrl = getClientPortalUrl();
  if (!profile || authError || invitationResult.error || !authData.user?.email || !portalUrl) {
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
    clientPortalUrl: portalUrl,
    invitation: invitationResult.data ? {
      id: invitationResult.data.id,
      deliveryStatus: invitationResult.data.delivery_status as ClientInvitationDeliveryStatus,
      acceptedAt: invitationResult.data.accepted_at,
      lastAttemptAt: invitationResult.data.last_attempt_at,
      sentAt: invitationResult.data.sent_at,
    } : null,
    smtpVerified: process.env.ZEVANTAA_SMTP_VERIFIED === "true",
    userId,
  };
}

export async function generateClientPasswordSetupLink(userId: string): Promise<string> {
  const actor = await requireApplicationRole("admin");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("client-provision", actor.userId!, 10);
  }
  const db = createSupabaseAdminClient();
  const { data: role, error: roleError } = await db.from("user_roles")
    .select("candidate_profile_id, account_status").eq("user_id", userId)
    .eq("role_code", "client").maybeSingle();
  if (roleError || !role?.candidate_profile_id || role.account_status !== "active") {
    throw new Error("Client access is unavailable.");
  }
  const [{ data: profile, error: profileError }, authResult] = await Promise.all([
    db.from("candidate_profiles").select("primary_email").eq("id", role.candidate_profile_id)
      .is("archived_at", null).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  if (profileError || authResult.error || !profile || !authResult.data.user?.email ||
      profile.primary_email.trim().toLowerCase() !== authResult.data.user.email.trim().toLowerCase()) {
    throw new Error("Client access could not be verified.");
  }
  const redirectTo = getClientRecoveryRedirectUrl();
  if (!redirectTo) throw new Error("Password setup is not configured.");
  const generated = await db.auth.admin.generateLink({
    type: "recovery", email: authResult.data.user.email, options: { redirectTo },
  });
  if (generated.error || generated.data.user.id !== userId || !generated.data.properties.action_link) {
    throw new Error("A secure password-setup link could not be generated.");
  }
  const actionLink = new URL(generated.data.properties.action_link);
  if (actionLink.protocol !== "https:" || !actionLink.pathname.endsWith("/auth/v1/verify")) {
    throw new Error("The password-setup provider returned an invalid link.");
  }
  return actionLink.toString();
}

/** Replaces (never retrieves) a client credential and returns it exactly once. */
export async function reissueClientTemporaryPassword(userId: string): Promise<string> {
  const actor = await requireApplicationRole("admin");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("client-provision", actor.userId!, 10);
  }
  const db = createSupabaseAdminClient();
  const { data: role, error: roleError } = await db.from("user_roles")
    .select("candidate_profile_id, account_status").eq("user_id", userId)
    .eq("role_code", "client").maybeSingle();
  if (roleError || !role?.candidate_profile_id || role.account_status !== "active") {
    throw new Error("Client access is unavailable.");
  }
  const [profileResult, authResult] = await Promise.all([
    db.from("candidate_profiles").select("primary_email").eq("id", role.candidate_profile_id)
      .is("archived_at", null).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  const user = authResult.data.user;
  if (profileResult.error || authResult.error || !profileResult.data || !user?.email ||
      profileResult.data.primary_email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    throw new Error("Client access could not be verified.");
  }
  const temporaryPassword = createTemporaryPassword();
  const { error } = await db.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    app_metadata: { ...user.app_metadata, must_change_password: true },
  });
  if (error) throw new Error("The temporary password could not be issued.");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/audit-events")).recordSecurityEvent({
      eventType: "client.account.updated", actorUserId: actor.userId!, targetUserId: userId,
      candidateProfileId: role.candidate_profile_id, outcome: "success", detailCode: "profile-update",
    });
  }
  return temporaryPassword;
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
  accessMethod,
  accountStatus,
  candidateProfileId,
  profile,
}: ProvisionClientAccountInput): Promise<ProvisionClientAccountResult> {
  const resolvedAccessMethod = accessMethod ?? "invitation";
  const adminContext = await requireApplicationRole("admin");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("client-provision", adminContext.userId!, 10);
  }
  const supabase = createSupabaseAdminClient();
  const creatingProfile = candidateProfileId === "new";
  const linkedProfileId = creatingProfile ? randomUUID() : candidateProfileId;
  let candidateSnapshot: Record<string, unknown> | null = null;
  let candidateUpdatedAt: string | null = null;
  if (!creatingProfile) {
    const { data: candidate, error: candidateError } = await supabase
      .from("candidate_profiles")
      .select("full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference, selected_package_code, target_markets, updated_at")
      .eq("id", linkedProfileId)
      .is("archived_at", null)
      .maybeSingle();
    if (candidateError || !candidate) return { code: "missing-candidate", ok: false };
    candidateSnapshot = { ...candidate, target_markets: [...candidate.target_markets] };
    candidateUpdatedAt = candidate.updated_at;

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

  const profileWriteAt = new Date().toISOString();
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
          updated_at: profileWriteAt,
          updated_by_user_id: adminContext.userId,
        })
        .eq("id", linkedProfileId)
        .eq("updated_at", candidateUpdatedAt)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();
  if (profileWrite.error || (!creatingProfile && !profileWrite.data)) {
    return { code: "profile-update", ok: false };
  }

  const redirectTo = resolvedAccessMethod === "invitation" ? getClientInvitationRedirectUrl() : null;
  if (resolvedAccessMethod === "invitation" && !redirectTo) return { code: "auth-creation", ok: false };

  const { data: invitation, error: invitationError } = await supabase
    .from("client_onboarding_invitations")
    .insert({
      account_status: accountStatus,
      candidate_profile_id: linkedProfileId,
      created_by_user_id: adminContext.userId,
      delivery_status: "pending",
      email: profile.email,
      attempt_count: resolvedAccessMethod === "invitation" ? 1 : 0,
      last_attempt_at: resolvedAccessMethod === "invitation" ? new Date().toISOString() : null,
    })
    .select("id")
    .maybeSingle();
  if (invitationError || !invitation) {
    const rollback = creatingProfile
      ? await supabase.from("candidate_profiles").delete().eq("id", linkedProfileId)
      : await supabase.from("candidate_profiles").update({
          ...candidateSnapshot,
          updated_at: new Date().toISOString(),
          updated_by_user_id: adminContext.userId,
        }).eq("id", linkedProfileId).eq("updated_at", profileWriteAt);
    return { code: rollback.error ? "reconciliation-required" : "invitation-state", ok: false };
  }

  const temporaryPassword = resolvedAccessMethod === "temporary-password" ? createTemporaryPassword() : undefined;
  const { data: authData, error: authError } = resolvedAccessMethod === "temporary-password"
    ? await supabase.auth.admin.createUser({
        email: profile.email,
        password: temporaryPassword!,
        email_confirm: true,
        app_metadata: { must_change_password: true },
      })
    : await supabase.auth.admin.inviteUserByEmail(profile.email, { redirectTo: redirectTo! });

  if (authError || !authData.user) {
    const duplicateAuth = authError?.code === "email_exists" || authError?.code === "user_already_exists";
    const cleanupError = authData.user && !duplicateAuth
      ? (await supabase.auth.admin.deleteUser(authData.user.id)).error
      : null;
    await supabase.from("client_onboarding_invitations").update({
      auth_user_id: cleanupError && authData.user ? authData.user.id : null,
      delivery_status: "failed",
      last_error_code: duplicateAuth ? "duplicate-email" : cleanupError ? "auth-cleanup-failed" : "delivery-failed",
      updated_at: new Date().toISOString(),
    }).eq("id", invitation.id).eq("delivery_status", "pending");
    if (duplicateAuth) {
      return { code: "duplicate-email", ok: false };
    }
    if (cleanupError) return { code: "linkage-cleanup", ok: false };
    return { code: "invitation-delivery", invitationId: invitation.id, ok: false };
  }

  const { error: roleError } = await supabase.from("user_roles").insert({
    account_status: accountStatus,
    candidate_profile_id: linkedProfileId,
    role_code: "client",
    user_id: authData.user.id,
  });

  if (!roleError) {
    const deliveryStatus = resolvedAccessMethod === "invitation" ? "sent" : "not-sent";
    const { data: sent, error: sentError } = await supabase
      .from("client_onboarding_invitations")
      .update({
        auth_user_id: authData.user.id,
        delivery_status: deliveryStatus,
        last_error_code: null,
        sent_at: resolvedAccessMethod === "invitation" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .eq("delivery_status", "pending")
      .select("id")
      .maybeSingle();
    if (sentError || !sent) {
      return { code: "reconciliation-required", invitationId: invitation.id, ok: false };
    }
    if (process.env.NODE_ENV === "production") {
      await (await import("@/lib/security/audit-events")).recordSecurityEvent({
        eventType: "client.account.created", actorUserId: adminContext.userId!,
        targetUserId: authData.user.id, candidateProfileId: linkedProfileId, outcome: "success",
      });
    }
    return temporaryPassword
      ? { ok: true, packageName: selectedPackage.display_name, invitationId: invitation.id, temporaryPassword }
      : { ok: true, packageName: selectedPackage.display_name, invitationId: invitation.id };
  }

  const { error: cleanupError } = await supabase.auth.admin.deleteUser(
    authData.user.id,
  );

  await supabase.from("client_onboarding_invitations").update({
    auth_user_id: cleanupError ? authData.user.id : null,
    delivery_status: "failed",
    last_error_code: cleanupError ? "linkage-cleanup" : "linkage-failed",
    updated_at: new Date().toISOString(),
  }).eq("id", invitation.id).eq("delivery_status", "pending");

  return {
    code: cleanupError ? "linkage-cleanup" : "linkage",
    invitationId: invitation.id,
    ok: false,
  };
}

/**
 * Retry failed first delivery or issue a fresh setup email for an unaccepted
 * linked account. The durable row is claimed before any provider call, so
 * concurrent clicks cannot send duplicate messages.
 */
export async function retryClientInvitation(invitationId: string): Promise<RetryClientInvitationResult> {
  const adminContext = await requireApplicationRole("admin");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("client-provision", adminContext.userId!, 10);
  }
  const supabase = createSupabaseAdminClient();
  const { data: invitation, error } = await supabase.from("client_onboarding_invitations")
    .select("id, candidate_profile_id, email, account_status, delivery_status, attempt_count, auth_user_id, accepted_at")
    .eq("id", invitationId).maybeSingle();
  if (error || !invitation || invitation.accepted_at || invitation.attempt_count >= 20 ||
      !["failed", "sent"].includes(invitation.delivery_status)) {
    return { code: "invitation-state", ok: false };
  }

  if (invitation.auth_user_id) {
    if (invitation.account_status !== "active") return { code: "invitation-state", ok: false };
    const [roleResult, profileResult, authResult] = await Promise.all([
      supabase.from("user_roles").select("user_id, account_status, role_code")
        .eq("candidate_profile_id", invitation.candidate_profile_id)
        .eq("user_id", invitation.auth_user_id).eq("role_code", "client").maybeSingle(),
      supabase.from("candidate_profiles").select("id").eq("id", invitation.candidate_profile_id)
        .is("archived_at", null).maybeSingle(),
      supabase.auth.admin.getUserById(invitation.auth_user_id),
    ]);
    const authUser = authResult.data.user;
    if (roleResult.error || profileResult.error || authResult.error || !roleResult.data ||
        roleResult.data.account_status !== "active" || !profileResult.data || !authUser?.email ||
        authUser.email.trim().toLowerCase() !== invitation.email) {
      return { code: "invitation-state", invitationId, email: invitation.email, ok: false };
    }
    const invitationRedirect = getClientInvitationRedirectUrl();
    const recoveryRedirect = getClientRecoveryRedirectUrl();
    if (!invitationRedirect || !recoveryRedirect) {
      return { code: "auth-creation", invitationId, email: invitation.email, ok: false };
    }
    const { data: claimed, error: claimError } = await supabase.from("client_onboarding_invitations")
      .update({
        attempt_count: invitation.attempt_count + 1,
        delivery_status: "pending",
        last_attempt_at: new Date().toISOString(),
        last_error_code: null,
        updated_at: new Date().toISOString(),
      }).eq("id", invitationId).eq("delivery_status", invitation.delivery_status)
      .eq("attempt_count", invitation.attempt_count).eq("auth_user_id", invitation.auth_user_id)
      .is("accepted_at", null).select("id").maybeSingle();
    if (claimError || !claimed) return { code: "invitation-state", ok: false };

    const confirmed = Boolean(authUser.email_confirmed_at);
    let deliveryError: unknown = null;
    let invitedUserId: string | null = null;
    if (confirmed) {
      const delivery = await supabase.auth.resetPasswordForEmail(invitation.email, { redirectTo: recoveryRedirect });
      deliveryError = delivery.error;
    } else {
      const delivery = await supabase.auth.admin.inviteUserByEmail(invitation.email, { redirectTo: invitationRedirect });
      deliveryError = delivery.error;
      invitedUserId = delivery.data.user?.id ?? null;
    }
    if (deliveryError || (!confirmed && invitedUserId !== invitation.auth_user_id)) {
      await supabase.from("client_onboarding_invitations").update({
        delivery_status: "failed",
        last_error_code: "delivery-failed",
        updated_at: new Date().toISOString(),
      }).eq("id", invitationId).eq("delivery_status", "pending")
        .eq("auth_user_id", invitation.auth_user_id);
      return { code: "invitation-delivery", invitationId, email: invitation.email, ok: false };
    }
    const { data: sent, error: sentError } = await supabase.from("client_onboarding_invitations")
      .update({ delivery_status: "sent", last_error_code: null, sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString() })
      .eq("id", invitationId).eq("delivery_status", "pending")
      .eq("auth_user_id", invitation.auth_user_id).select("id").maybeSingle();
    if (sentError || !sent) {
      return { code: "invitation-state", invitationId, email: invitation.email, ok: false };
    }
    return { ok: true, invitationId, email: invitation.email };
  }

  if (invitation.delivery_status !== "failed") return { code: "invitation-state", ok: false };
  const [{ data: role, error: roleLookupError }, { data: profile, error: profileLookupError }] = await Promise.all([
    supabase.from("user_roles").select("user_id")
      .eq("candidate_profile_id", invitation.candidate_profile_id).maybeSingle(),
    supabase.from("candidate_profiles").select("id").eq("id", invitation.candidate_profile_id)
      .is("archived_at", null).maybeSingle(),
  ]);
  if (roleLookupError || profileLookupError || role || !profile) return { code: "invitation-state", ok: false };

  const redirectTo = getClientInvitationRedirectUrl();
  if (!redirectTo) return { code: "auth-creation", invitationId, email: invitation.email, ok: false };
  const { data: claimed, error: claimError } = await supabase.from("client_onboarding_invitations")
    .update({
      attempt_count: invitation.attempt_count + 1,
      delivery_status: "pending",
      last_attempt_at: new Date().toISOString(),
      last_error_code: null,
      updated_at: new Date().toISOString(),
    }).eq("id", invitationId).eq("delivery_status", "failed").eq("attempt_count", invitation.attempt_count)
    .select("id").maybeSingle();
  if (claimError || !claimed) return { code: "invitation-state", ok: false };

  const { data: authData, error: authError } = await supabase.auth.admin
    .inviteUserByEmail(invitation.email, { redirectTo });
  if (authError || !authData.user) {
    const duplicateAuth = authError?.code === "email_exists" || authError?.code === "user_already_exists";
    const cleanupError = authData.user && !duplicateAuth
      ? (await supabase.auth.admin.deleteUser(authData.user.id)).error
      : null;
    await supabase.from("client_onboarding_invitations").update({
      auth_user_id: cleanupError && authData.user ? authData.user.id : null,
      delivery_status: "failed",
      last_error_code: duplicateAuth ? "duplicate-email" : cleanupError ? "auth-cleanup-failed" : "delivery-failed",
      updated_at: new Date().toISOString(),
    }).eq("id", invitationId).eq("delivery_status", "pending");
    if (duplicateAuth) {
      return { code: "duplicate-email", email: invitation.email, ok: false };
    }
    if (cleanupError) return { code: "linkage-cleanup", email: invitation.email, ok: false };
    return { code: "invitation-delivery", invitationId, email: invitation.email, ok: false };
  }
  const { error: roleError } = await supabase.from("user_roles").insert({
    account_status: invitation.account_status,
    candidate_profile_id: invitation.candidate_profile_id,
    role_code: "client",
    user_id: authData.user.id,
  });
  if (roleError) {
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(authData.user.id);
    await supabase.from("client_onboarding_invitations").update({
      auth_user_id: cleanupError ? authData.user.id : null,
      delivery_status: "failed",
      last_error_code: cleanupError ? "linkage-cleanup" : "linkage-failed",
      updated_at: new Date().toISOString(),
    }).eq("id", invitationId).eq("delivery_status", "pending");
    return { code: cleanupError ? "linkage-cleanup" : "linkage", invitationId, email: invitation.email, ok: false };
  }
  const { data: sent, error: sentError } = await supabase.from("client_onboarding_invitations")
    .update({ auth_user_id: authData.user.id, delivery_status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", invitationId).eq("delivery_status", "pending").select("id").maybeSingle();
  if (sentError || !sent) return { code: "invitation-state", invitationId, email: invitation.email, ok: false };
  return { ok: true, invitationId, email: invitation.email };
}

export async function updateClientAccount({
  accountStatus,
  confirmDeactivation,
  profile: changes,
  userId,
}: UpdateClientAccountInput): Promise<UpdateClientAccountResult> {
  const adminContext = await requireApplicationRole("admin");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("client-edit", adminContext.userId!, 30);
  }
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

  // A database row alone must not authorize an eighth or retired V1 package.
  if (!getPackageRouting(changes.packageCode)) {
    return { code: "invalid-package", ok: false };
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
    // Do not report success from the mutation response or form state alone.
    // Reload the linked profile and confirm the package that actually persisted.
    const { data: savedProfile, error: reloadError } = await supabase
      .from("candidate_profiles")
      .select("selected_package_code")
      .eq("id", candidateProfileId)
      .is("archived_at", null)
      .maybeSingle();
    if (reloadError || savedProfile?.selected_package_code !== changes.packageCode) {
      return { code: "reconciliation-required", ok: false };
    }
    if (process.env.NODE_ENV === "production") {
      await (await import("@/lib/security/audit-events")).recordSecurityEvent({
        eventType: accountStatus === "disabled" ? "client.account.disabled"
          : role.account_status === "disabled" ? "client.account.reactivated" : "client.account.updated",
        actorUserId: adminContext.userId!, targetUserId: userId,
        candidateProfileId, outcome: "success",
        detailCode: profileSnapshot.selected_package_code !== changes.packageCode
          ? "package-assignment" : "profile-update",
      });
    }
    return { ok: true, packageCode: savedProfile.selected_package_code };
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
