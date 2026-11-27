import type { DocumentData } from "./profile-mapper";

export const JOB_COMPATIBILITY_VERSION = "jd-keyword-v1";

const STOP = new Set(["about", "after", "also", "and", "apply", "based", "candidate", "company", "experience", "from", "have", "including", "knowledge", "more", "must", "other", "position", "preferred", "required", "responsibilities", "role", "skills", "team", "that", "their", "them", "this", "those", "with", "work", "working", "years", "your"]);
const tokens = (value: string): string[] => (value.toLocaleLowerCase("en").match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu) ?? []);
const normalized = (value: string) => tokens(value).join(" ");

export interface JobCompatibilityResult {
  algorithmVersion: typeof JOB_COMPATIBILITY_VERSION;
  score: number;
  matched: string[];
  missing: string[];
  considered: string[];
  source: "client-confirmed-keywords" | "description-terms";
}

/** Exact term and phrase presence in reviewed profile facts; no semantic or hiring prediction. */
export function calculateJobDescriptionCompatibility(data: DocumentData): JobCompatibilityResult | null {
  const target = data.regionalIntake?.global;
  if (!target?.jobDescription?.trim() && !target?.targetKeywords?.length) return null;
  const explicit = (target.targetKeywords ?? []).map((term) => term.trim()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const word of tokens(target.jobDescription ?? "")) {
    if (word.length < 4 || STOP.has(word) || /^\d+$/u.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const inferred = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word).slice(0, 20);
  const source = explicit.length ? "client-confirmed-keywords" : "description-terms";
  const considered = (explicit.length ? explicit : inferred).filter((term, index, list) =>
    normalized(term) && list.findIndex((item) => normalized(item) === normalized(term)) === index);
  if (!considered.length) return null;
  const facts = [data.professionalSummary?.text,
    ...(data.employment ?? []).flatMap((item) => [item.jobTitle, item.employerName, item.description, ...item.highlights]),
    ...(data.skills ?? []).map((item) => item.name),
    ...(data.certifications ?? []).flatMap((item) => [item.name, item.issuingOrganization]),
    ...(data.projects ?? []).flatMap((item) => [item.name, item.description, ...item.technologies]),
    ...(target.functionalCompetencies ?? []), ...(target.technicalSkills ?? []),
  ].filter((item): item is string => Boolean(item)).map(normalized).join(" ");
  const matched = considered.filter((term) => (` ${facts} `).includes(` ${normalized(term)} `));
  const missing = considered.filter((term) => !matched.includes(term));
  return { algorithmVersion: JOB_COMPATIBILITY_VERSION,
    score: Math.round(100 * matched.length / considered.length), matched, missing, considered, source };
}
