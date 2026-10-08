import type { CandidateProfile } from "@/types/client-profile";

import { createEuropeanQaProfile } from "./european-qa-fixture";

/** Static fictional canonical data for transient admin-only QA. */
export function createCoverLetterQaProfile(sparse = false): CandidateProfile {
  const profile = createEuropeanQaProfile();
  const entitled: CandidateProfile = { ...profile,
    selectedPackage: "executive-transition-agency-distribution",
    targetMarkets: ["indian-domestic", "gcc-middle-east", "european-union"],
  };
  if (!sparse) return entitled;
  return { ...entitled, professionalSummary: undefined, workExperience: [], education: [],
    skills: [{ ...profile.skills[0], name: "General coordination" }],
    certifications: [], languages: [], projects: [], additionalSections: [] };
}
