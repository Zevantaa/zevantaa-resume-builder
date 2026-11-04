import "server-only";

import { loadCandidateProfileById } from "@/features/document-generation/admin-global-ats-service";
import { ATS_ALGORITHM_VERSION, calculateIndicativeAtsScore } from "@/features/document-generation/indicative-ats-score";
import { compareAtsAssessmentSnapshots, type AtsAssessmentComparison,
  type AtsAssessmentSnapshot } from "@/features/document-generation/ats-assessment-comparison";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { resolveLinkedClientProfile } from "./contact-profile-service";

/** Only the authenticated active client's trusted role-to-profile link is used. */
export async function getCurrentClientAtsScore() {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;
  const profile = await loadCandidateProfileById(linked.profileId);
  if (!profile) return null;
  return calculateIndicativeAtsScore(mapCandidateProfileToDocumentData(profile, "resume"));
}

/** Return a comparison only when the latest recorded snapshot is current. */
export async function getCurrentClientAtsComparison(): Promise<AtsAssessmentComparison | null> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;
  const db = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await db.from("candidate_profiles")
    .select("career_revision").eq("id", linked.profileId).is("archived_at", null).maybeSingle();
  if (profileError || !profile) return null;
  const { data, error } = await db.from("ats_assessment_snapshots")
    .select("career_revision, algorithm_version, score, breakdown, assessed_at")
    .eq("candidate_profile_id", linked.profileId)
    .eq("algorithm_version", ATS_ALGORITHM_VERSION)
    .order("career_revision", { ascending: false }).limit(2);
  if (error || !data || data.length < 2 || data[0].career_revision !== profile.career_revision) return null;
  return compareAtsAssessmentSnapshots(data as AtsAssessmentSnapshot[], profile.career_revision);
}
