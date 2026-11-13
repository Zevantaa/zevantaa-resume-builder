import "server-only";

import { createHash } from "node:crypto";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ClientDeletionImpact = {
  profileId: string; userId: string; fullName: string; email: string; packageCode: string;
  documentCount: number; uploadedFileCount: number;
};

export type ArchivedClient = ClientDeletionImpact & {
  archivedAt: string;
  recoveryUntil: string | null;
  recoverable: boolean;
};

async function loadImpact(profileId: string, archived: boolean | null): Promise<ClientDeletionImpact | null> {
  const db = createSupabaseAdminClient();
  let profileQuery = db.from("candidate_profiles")
    .select("id, full_name, primary_email, selected_package_code, archived_at")
    .eq("id", profileId);
  if (archived === true) profileQuery = profileQuery.not("archived_at", "is", null);
  if (archived === false) profileQuery = profileQuery.is("archived_at", null);
  const [{ data: profile, error }, roleResult, documents, files] = await Promise.all([
    profileQuery.maybeSingle(),
    db.from("user_roles").select("user_id, role_code").eq("candidate_profile_id", profileId).maybeSingle(),
    db.from("document_records").select("id", { count: "exact", head: true }).eq("candidate_profile_id", profileId),
    db.from("file_records").select("id", { count: "exact", head: true }).eq("candidate_profile_id", profileId),
  ]);
  if (error || roleResult.error || documents.error || files.error) throw new Error("Client lifecycle impact could not be loaded.");
  if (!profile || !roleResult.data || roleResult.data.role_code !== "client") return null;
  return {
    profileId, userId: roleResult.data.user_id, fullName: profile.full_name,
    email: profile.primary_email, packageCode: profile.selected_package_code,
    documentCount: documents.count ?? 0, uploadedFileCount: files.count ?? 0,
  };
}

export async function getClientDeletionImpact(profileId: string): Promise<ClientDeletionImpact | null> {
  await requireApplicationRole("admin");
  return loadImpact(profileId, false);
}

export async function listArchivedClients(): Promise<ArchivedClient[]> {
  await requireApplicationRole("admin");
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("candidate_profiles")
    .select("id, full_name, primary_email, selected_package_code, archived_at, client_recovery_until")
    .not("archived_at", "is", null).order("archived_at", { ascending: false });
  if (error) throw new Error("Archived clients could not be loaded.");
  const result: ArchivedClient[] = [];
  for (const profile of data ?? []) {
    const impact = await loadImpact(profile.id, true);
    if (impact) result.push({
      ...impact,
      archivedAt: profile.archived_at!,
      recoveryUntil: profile.client_recovery_until,
      recoverable: Boolean(profile.client_recovery_until
        && new Date(profile.client_recovery_until).getTime() >= Date.now()),
    });
  }
  return result;
}

export async function archiveClientAccount(profileId: string, confirmedEmail: string) {
  const actor = await requireApplicationRole("admin");
  const impact = await loadImpact(profileId, false);
  if (!impact || impact.email.trim().toLowerCase() !== confirmedEmail.trim().toLowerCase()) {
    return { ok: false as const, code: "confirmation" };
  }
  const db = createSupabaseAdminClient();
  const archived = await db.rpc("archive_client_account", {
    p_profile_id: profileId, p_actor_user_id: actor.userId, p_recovery_days: 30,
  });
  const row = Array.isArray(archived.data) ? archived.data[0] : null;
  if (archived.error || !row?.auth_user_id) return { ok: false as const, code: "archive" };
  const auth = await db.auth.admin.updateUserById(row.auth_user_id, { ban_duration: "876000h" });
  if (auth.error) {
    await db.from("client_lifecycle_events").insert({
      candidate_profile_id: profileId, auth_user_id: row.auth_user_id,
      actor_user_id: actor.userId, action: "archive", outcome: "failed", error_code: "auth-ban-failed",
    });
    return { ok: false as const, code: "auth-sync", archived: true as const };
  }
  return { ok: true as const, recoveryUntil: row.recovery_until as string };
}

export async function restoreClientAccount(profileId: string) {
  const actor = await requireApplicationRole("admin");
  const db = createSupabaseAdminClient();
  const { data: role, error } = await db.from("user_roles")
    .select("user_id, role_code").eq("candidate_profile_id", profileId).maybeSingle();
  if (error || !role || role.role_code !== "client") return { ok: false as const, code: "not-found" };
  const unban = await db.auth.admin.updateUserById(role.user_id, { ban_duration: "none" });
  if (unban.error) return { ok: false as const, code: "auth-sync" };
  const restored = await db.rpc("restore_client_account", {
    p_profile_id: profileId, p_actor_user_id: actor.userId,
  });
  if (restored.error || restored.data !== role.user_id) {
    await db.auth.admin.updateUserById(role.user_id, { ban_duration: "876000h" });
    return { ok: false as const, code: "restore" };
  }
  return { ok: true as const };
}

export async function permanentlyDeleteClient(profileId: string, confirmedEmail: string) {
  if (process.env.ZEVANTAA_PERMANENT_DELETION_ENABLED !== "true") {
    return { ok: false as const, code: "disabled" };
  }
  const actor = await requireApplicationRole("admin");
  const db = createSupabaseAdminClient();
  const { data: profile, error } = await db.from("candidate_profiles")
    .select("primary_email, archived_at, client_recovery_until")
    .eq("id", profileId).not("archived_at", "is", null).maybeSingle();
  const { data: role, error: roleError } = await db.from("user_roles")
    .select("user_id, role_code").eq("candidate_profile_id", profileId).maybeSingle();
  if (error || roleError || !profile || !role || role.role_code !== "client" ||
      profile.primary_email.trim().toLowerCase() !== confirmedEmail.trim().toLowerCase() ||
      !profile.client_recovery_until || new Date(profile.client_recovery_until).getTime() >= Date.now()) {
    return { ok: false as const, code: "not-eligible" };
  }
  const active = await Promise.all([
    db.from("resume_processing_jobs").select("id", { count: "exact", head: true }).eq("candidate_profile_id", profileId).eq("status", "processing"),
    db.from("document_regeneration_jobs").select("id", { count: "exact", head: true }).eq("candidate_profile_id", profileId).eq("status", "processing"),
    db.from("document_ats_assessments").select("id", { count: "exact", head: true }).eq("candidate_profile_id", profileId).eq("status", "processing"),
  ]);
  if (active.some((entry) => entry.error || (entry.count ?? 0) > 0)) return { ok: false as const, code: "active-jobs" };
  const confirmationHash = createHash("sha256").update(confirmedEmail.trim().toLowerCase()).digest("hex");
  const request = await db.from("client_permanent_deletion_requests").upsert({
    candidate_profile_id: profileId, auth_user_id: role.user_id,
    requested_by_user_id: actor.userId, confirmation_identifier_sha256: confirmationHash,
    status: "processing", attempts: 1, last_error_code: null, updated_at: new Date().toISOString(), completed_at: null,
  }, { onConflict: "candidate_profile_id" }).select("id").maybeSingle();
  if (request.error || !request.data) return { ok: false as const, code: "request" };
  await db.from("client_lifecycle_events").insert({
    candidate_profile_id: profileId, auth_user_id: role.user_id,
    actor_user_id: actor.userId, action: "permanent-delete-requested", outcome: "success",
  });
  try {
    const files = await db.from("file_records")
      .select("storage_bucket_name, storage_object_key").eq("candidate_profile_id", profileId)
      .not("storage_bucket_name", "is", null).not("storage_object_key", "is", null);
    if (files.error) throw new Error("file-inventory-failed");
    const allowed = new Set(["candidate-intake-private", "candidate-documents-private"]);
    for (const bucket of allowed) {
      const keys = (files.data ?? []).filter((file) => file.storage_bucket_name === bucket)
        .map((file) => file.storage_object_key as string);
      if (keys.some((key) => !key.startsWith(`${profileId}/`))) throw new Error("storage-scope-invalid");
      for (let offset = 0; offset < keys.length; offset += 100) {
        const removal = await db.storage.from(bucket).remove(keys.slice(offset, offset + 100));
        if (removal.error) throw new Error("storage-delete-failed");
      }
    }
    const softDelete = await db.auth.admin.deleteUser(role.user_id, true);
    if (softDelete.error) throw new Error("auth-disable-failed");
    const completed = await db.rpc("complete_client_permanent_deletion", {
      p_request_id: request.data.id, p_profile_id: profileId, p_actor_user_id: actor.userId,
    });
    if (completed.error || completed.data !== true) throw new Error("database-delete-failed");
    const hardDelete = await db.auth.admin.deleteUser(role.user_id, false);
    return { ok: true as const, authCleanupPending: Boolean(hardDelete.error) };
  } catch (cause) {
    const code = cause instanceof Error && /^[a-z0-9-]{1,80}$/u.test(cause.message) ? cause.message : "permanent-delete-failed";
    await db.from("client_permanent_deletion_requests").update({
      status: "failed", last_error_code: code, updated_at: new Date().toISOString(), completed_at: null,
    }).eq("id", request.data.id);
    await db.from("client_lifecycle_events").insert({
      candidate_profile_id: profileId, auth_user_id: role.user_id,
      actor_user_id: actor.userId, action: "permanent-delete-requested", outcome: "failed", error_code: code,
    });
    return { ok: false as const, code };
  }
}
