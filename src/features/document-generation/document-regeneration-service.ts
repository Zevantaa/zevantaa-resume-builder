import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { packageAllowsOutput } from "./package-routing";
import { generateAndPersistDocument, type PersistedOutputKind } from "./persistent-document-service";

type ClaimedDocumentJob = {
  job_id: string;
  candidate_profile_id?: string;
  output_kind: PersistedOutputKind;
  source_career_revision: number;
  lease_token: string;
  actor_user_id?: string;
};

async function processJobs(profileId: string | null, expectedActorUserId: string | null,
  limit = 1): Promise<{ completed: number; failed: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 2) throw new Error("Invalid regeneration request.");
  const db = createSupabaseAdminClient();
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < limit; index++) {
    const { data, error } = await db.rpc("claim_document_regeneration_job", { p_profile_id: profileId });
    if (error) throw new Error("Regeneration queue is unavailable.");
    const job = (Array.isArray(data) ? data[0] : null) as ClaimedDocumentJob | null;
    if (!job) break;
    const claimedProfileId = job.candidate_profile_id ?? profileId;
    const actorUserId = job.actor_user_id ?? expectedActorUserId;
    try {
      if (!claimedProfileId || !actorUserId ||
          (profileId && claimedProfileId !== profileId) ||
          (expectedActorUserId && job.actor_user_id && job.actor_user_id !== expectedActorUserId)) {
        throw new Error("invalid-claim");
      }
      const { data: profile, error: profileError } = await db.from("candidate_profiles")
        .select("career_revision, selected_package_code").eq("id", claimedProfileId)
        .is("archived_at", null).maybeSingle();
      if (profileError || !profile || profile.career_revision !== job.source_career_revision ||
          !packageAllowsOutput(profile.selected_package_code, job.output_kind)) {
        throw new Error("stale-or-unentitled");
      }
      await generateAndPersistDocument(claimedProfileId, job.output_kind,
        { actorUserId, job: { jobId: job.job_id, token: job.lease_token, revision: job.source_career_revision } });
      completed++;
    } catch (error) {
      const errorCode = error instanceof Error &&
        (error.message === "invalid-claim" || error.message === "stale-or-unentitled")
        ? error.message : "generation-failed";
      const result = await db.rpc("fail_document_regeneration_job", {
        p_job_id: job.job_id, p_lease_token: job.lease_token, p_error_code: errorCode,
      });
      if (result.error || result.data !== true) throw new Error("Regeneration failure could not be recorded.");
      failed++;
    }
  }
  return { completed, failed };
}

/** Process a bounded profile-scoped batch after an authenticated client action. */
export async function processDocumentRegenerationJobs(profileId: string, actorUserId: string,
  limit = 1): Promise<{ completed: number; failed: number }> {
  if (!profileId || !actorUserId) throw new Error("Invalid regeneration request.");
  return processJobs(profileId, actorUserId, limit);
}

/** Process a bounded global batch for the authenticated Zevantaa scheduler. */
export async function processGlobalDocumentRegenerationJobs(limit = 1): Promise<{ completed: number; failed: number }> {
  return processJobs(null, null, limit);
}
