import type { CandidateProfile } from "@/types/client-profile";

import { createLongGlobalAtsQaProfile } from "./global-ats-qa-fixture";

/** Fixed, fictional data. Not linked to a real candidate or storage object. */
export function createEuropeanQaProfile(long = false): CandidateProfile {
  const profile = createLongGlobalAtsQaProfile();
  const european: CandidateProfile = {
    ...profile,
    selectedPackage: "europass-european-union",
    targetMarkets: ["european-union"],
  };
  if (long) return european;
  return {
    ...european,
    fullName: "Rohan Kapoor",
    currentLocation: "Fictional Chandigarh",
    professionalSummary: "Fictional operations and supply chain professional with candidate-supplied experience in planning, reporting and cross-functional handoffs.",
    workExperience: profile.workExperience.slice(0, 2).map((item) => ({ ...item, highlights: item.highlights.slice(0, 2) })),
    education: profile.education,
    skills: profile.skills.slice(0, 8),
    certifications: profile.certifications.slice(0, 1),
    projects: profile.projects,
    languages: profile.languages,
    additionalSections: profile.additionalSections,
  };
}
