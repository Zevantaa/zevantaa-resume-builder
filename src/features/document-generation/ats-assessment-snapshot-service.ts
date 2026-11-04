import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { ATS_ALGORITHM_VERSION, type IndicativeAtsScore } from "./indicative-ats-score";

/** Persist a deterministic ready assessment for the exact current revision. */
export async function recordIndicativeAtsAssessment(
  profileId: string,
  careerRevision: number,
  result: IndicativeAtsScore,
): Promise<void> {
  if (result.status !== "ready") return;
  const { error } = await createSupabaseAdminClient().rpc("record_ats_assessment_snapshot", {
    p_profile_id: profileId,
    p_career_revision: careerRevision,
    p_algorithm_version: ATS_ALGORITHM_VERSION,
    p_score: result.score,
    p_benchmark: result.benchmark,
    p_breakdown: result.breakdown,
  });
  if (error) throw new Error("ATS assessment provenance could not be recorded.");
}
