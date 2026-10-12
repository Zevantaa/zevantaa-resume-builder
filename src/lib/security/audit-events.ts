import "server-only";

import { createSupabaseAdminClient } from "../supabase/admin";

export type SecurityEventType =
  | "client.account.created" | "client.account.updated" | "client.account.disabled"
  | "client.account.reactivated" | "client.career.saved" | "client.resume.replaced"
  | "client.photo.replaced" | "resume.review.confirmed" | "document.generated"
  | "document.privacy_generated" | "brand.settings.changed"
  | "recovery.password.updated";

export type SecurityEvent = {
  eventType: SecurityEventType;
  actorUserId: string;
  targetUserId?: string;
  candidateProfileId?: string;
  outcome: "success" | "denied" | "failed";
  /** Controlled classification only; never candidate content or free-form notes. */
  detailCode?: "package-assignment" | "profile-update";
};

/** Best-effort record after a completed operation; never accept arbitrary event metadata. */
export async function recordSecurityEvent(event: SecurityEvent): Promise<boolean> {
  try {
    const { error } = await createSupabaseAdminClient().from("security_audit_events").insert({
      event_type: event.eventType,
      actor_user_id: event.actorUserId,
      target_user_id: event.targetUserId ?? null,
      candidate_profile_id: event.candidateProfileId ?? null,
      outcome: event.outcome,
      metadata: event.detailCode ? { detail_code: event.detailCode } : {},
    });
    return !error;
  } catch {
    // Mutations must not be replayed because the audit sink is unavailable.
    return false;
  }
}
