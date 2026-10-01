import "server-only";

import { loadCandidateProfileById } from "@/features/document-generation/admin-global-ats-service";
import { calculateIndicativeAtsScore } from "@/features/document-generation/indicative-ats-score";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

import { resolveLinkedClientProfile } from "./contact-profile-service";

/** Only the authenticated active client's trusted role-to-profile link is used. */
export async function getCurrentClientAtsScore() {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;
  const profile = await loadCandidateProfileById(linked.profileId);
  if (!profile) return null;
  return calculateIndicativeAtsScore(mapCandidateProfileToDocumentData(profile, "resume"));
}
