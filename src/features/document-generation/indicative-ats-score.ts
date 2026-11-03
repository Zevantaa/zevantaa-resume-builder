import { buildGlobalAtsResumeModel } from "./global-ats-resume";
import { isAtsScoreVisible } from "./package-routing";
import type { DocumentDataMappingResult } from "./profile-mapper";
import { normalizeSkillName } from "../client-portal/skill-name";

/** Fixed optimization target, never a minimum or adjustment to the calculated score. */
export const ATS_BENCHMARK = 90;
export const ATS_ALGORITHM_VERSION = "zevantaa-indicative-ats-v1";
export const ATS_SCORE_WEIGHTS = {
  contact: 15,
  summary: 10,
  experience: 25,
  education: 10,
  skills: 15,
  formatting: 10,
  dates: 5,
  optionalDepth: 10,
} as const;

export type AtsScoreDimension = keyof typeof ATS_SCORE_WEIGHTS;
export type AtsScoreBreakdown = {
  dimension: AtsScoreDimension;
  label: string;
  score: number;
  maximum: number;
  reason: string;
  suggestion?: string;
};
export type IndicativeAtsScore =
  | { status: "not-ready"; benchmark: typeof ATS_BENCHMARK; reasons: string[] }
  | { status: "ready"; score: number; benchmark: typeof ATS_BENCHMARK;
      band: "below-benchmark" | "near-benchmark" | "meets-benchmark";
      breakdown: AtsScoreBreakdown[]; suggestions: string[] };

const hasText = (value: string | undefined | null) => Boolean(value?.trim());
const hasDetail = (item: { description?: string; highlights: string[] }) =>
  hasText(item.description) || item.highlights.some(hasText);
const validMonth = (value: string | undefined) => /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(value ?? "");
const label: Record<AtsScoreDimension, string> = {
  contact: "Contact completeness", summary: "Professional summary", experience: "Experience completeness",
  education: "Education completeness", skills: "Skills coverage", formatting: "ATS formatting",
  dates: "Date consistency", optionalDepth: "Optional profile depth",
};

/** Deterministic assessment of reviewed canonical data and its Global ATS PDF model. */
export function calculateIndicativeAtsScore(mapping: DocumentDataMappingResult): IndicativeAtsScore {
  const hasSubstantiveCareerEntry = Boolean(mapping.data.employment?.length || mapping.data.education?.length || mapping.data.projects?.length);
  if (!mapping.canGenerate || !hasSubstantiveCareerEntry || !isAtsScoreVisible(mapping.data.packageContext.selectedPackage)) {
    return { status: "not-ready", benchmark: ATS_BENCHMARK,
      reasons: [
        ...mapping.findings.filter((finding) => finding.severity === "error").map((finding) => finding.message),
        ...(!hasSubstantiveCareerEntry ? ["Add at least one reviewed employment, education, or project entry before evaluating the Global ATS resume."] : []),
        ...(!isAtsScoreVisible(mapping.data.packageContext.selectedPackage) ? ["The assigned package does not include a Global ATS resume."] : []),
      ] };
  }
  const { data } = mapping;
  const resume = buildGlobalAtsResumeModel(mapping);
  const employment = data.employment ?? [];
  const education = data.education ?? [];
  const skills = data.skills ?? [];
  const distinctSkillCount = new Set(skills.map((item) => normalizeSkillName(item.name).key).filter(Boolean)).size;
  const summaryLength = data.professionalSummary?.text.trim().length ?? 0;
  const dated = employment.length + education.filter((item) => item.startDate || item.endDate || item.completionYear).length;
  const consistentDates = employment.every((item) => validMonth(item.startDate) &&
    (item.currentRole ? !item.endDate : !item.endDate || validMonth(item.endDate)) &&
    (!item.endDate || !item.startDate || item.startDate <= item.endDate)) &&
    education.every((item) => (!item.startDate || validMonth(item.startDate)) &&
      (!item.endDate || validMonth(item.endDate)) &&
      (!item.startDate || !item.endDate || item.startDate <= item.endDate));
  const breakdown: AtsScoreBreakdown[] = [];
  const add = (dimension: AtsScoreDimension, score: number, reason: string, suggestion?: string) => {
    breakdown.push({ dimension, label: label[dimension], score, maximum: ATS_SCORE_WEIGHTS[dimension], reason,
      ...(suggestion && score < ATS_SCORE_WEIGHTS[dimension] ? { suggestion } : {}) });
  };
  const contact = (hasText(data.identity.fullName) ? 4 : 0) +
    (hasText(data.identity.primaryEmail) ? 4 : 0) + (hasText(data.identity.mobileNumber) ? 4 : 0) +
    (hasText(data.identity.currentLocation) ? 3 : 0);
  add("contact", contact, `${contact}/15 available identity and contact points.`, "Add a current location to the profile.");
  const summary = summaryLength === 0 ? 0 : summaryLength >= 80 ? 10 : 5;
  add("summary", summary, summaryLength ? `Candidate-supplied summary: ${summaryLength} characters.` : "No professional summary supplied.",
    "Add or expand the candidate-supplied professional summary; do not invent claims.");
  const experience = employment.length === 0 ? 0 : 10 +
    (employment.every((item) => hasText(item.jobTitle) && hasText(item.employerName) && hasText(item.startDate)) ? 5 : 0) +
    (employment.every(hasDetail) ? 6 : 0) + (employment.length >= 2 ? 4 : 0);
  add("experience", experience, `${employment.length} complete, ordered employment entries; ${employment.filter(hasDetail).length} include supplied detail.`,
    "Review employment entries and add factual responsibilities or achievements where available.");
  const educationScore = education.length === 0 ? 0 : 6 +
    (education.every((item) => hasText(item.qualification) && hasText(item.institutionName)) ? 2 : 0) +
    (education.every((item) => Boolean(item.completionYear || item.endDate || item.startDate)) ? 2 : 0);
  add("education", educationScore, `${education.length} education entries; dates count only when explicitly supplied.`,
    "Add verified education details or dates if available.");
  const skillScore = (distinctSkillCount >= 1 ? 5 : 0) + (distinctSkillCount >= 4 ? 5 : 0) + (distinctSkillCount >= 8 ? 5 : 0);
  add("skills", skillScore, `${distinctSkillCount} distinct, individually stored skills.`, "Add relevant, verified skills individually.");
  const sectionIds = resume.sections.map((section) => section.id);
  const formatScore = resume.sections[0]?.id === "identity" &&
    sectionIds.every((id, index) => index === 0 || id !== "identity") &&
    resume.sections.every((section) => section.blocks.every((block) => block.kind !== "columns" && block.kind !== "page-break")) &&
    !resume.header && !resume.footer ? 10 : 0;
  add("formatting", formatScore, formatScore === 10 ? "Single-column Global ATS model with text sections and no running header/footer." : "ATS layout rules need review.");
  const dateScore = dated > 0 && consistentDates ? 5 : 0;
  add("dates", dateScore, dated === 0 ? "No dated employment or education entries." :
    consistentDates ? "Stored month dates are well-formed and ordered." : "Some stored dates are malformed or out of order.",
    "Review explicit employment and education dates; do not infer missing dates.");
  const optional = (data.certifications?.length ? 4 : 0) + (data.projects?.length ? 3 : 0) + (data.languages?.length ? 3 : 0);
  add("optionalDepth", optional, "Optional certifications, projects, and languages count only when supplied.",
    "Add applicable verified certifications, projects, or languages; optional sections are not required.");
  const score = breakdown.reduce((total, item) => total + item.score, 0);
  return { status: "ready", score, benchmark: ATS_BENCHMARK,
    band: score >= ATS_BENCHMARK ? "meets-benchmark" : score >= 75 ? "near-benchmark" : "below-benchmark",
    breakdown, suggestions: breakdown.flatMap((item) => item.suggestion ? [item.suggestion] : []) };
}
