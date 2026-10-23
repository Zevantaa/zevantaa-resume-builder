import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { packageAllowsOutput } from "./package-routing";
import { generateAndPersistDocument, type PersistedOutputKind } from "./persistent-document-service";

/** Process a bounded number of durable jobs, never an unbounded request-time queue. */
export async function processDocumentRegenerationJobs(profileId: string, actorUserId: string,
  limit = 1): Promise<{ completed: number; failed: number }> {
  if (!actorUserId || !Number.isInteger(limit) || limit < 1 || limit > 2) throw new Error("Invalid regeneration request.");
  const db = createSupabaseAdminClient();
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < limit; index++) {
    const { data, error } = await db.rpc("claim_document_regeneration_job", { p_profile_id: profileId });
    if (error) throw new Error("Regeneration queue is unavailable.");
    const job = Array.isArray(data) ? data[0] : null;
    if (!job) break;
    try {
      const { data: profile, error: profileError } = await db.from("candidate_profiles")
        .select("career_revision, selected_package_code").eq("id", profileId)
        .is("archived_at", null).maybeSingle();
      if (profileError || !profile || profile.career_revision !== job.source_career_revision ||
          !packageAllowsOutput(profile.selected_package_code, job.output_kind)) {
        throw new Error("stale-or-unentitled");
      }
      await generateAndPersistDocument(profileId, job.output_kind as PersistedOutputKind,
        { actorUserId, job: { jobId: job.job_id, token: job.lease_token, revision: job.source_career_revision } });
      completed++;
    } catch {
      const result = await db.rpc("fail_document_regeneration_job", {
        p_job_id: job.job_id, p_lease_token: job.lease_token, p_error_code: "generation-failed",
      });
      if (result.error) throw new Error("Regeneration failure could not be recorded.");
      failed++;
    }
  }
  return { completed, failed };
}
