import type { AtsScoreBreakdown, AtsScoreDimension } from "./indicative-ats-score";

export const DOCUMENT_ATS_ALGORITHM_VERSION = "zevantaa-document-ats-v1";

export type DocumentAtsAssessment =
  | { status: "unavailable"; findings: string[] }
  | { status: "ready"; score: number; breakdown: AtsScoreBreakdown[]; findings: string[] };

const LABELS: Record<AtsScoreDimension, string> = {
  contact: "Contact discoverability",
  summary: "Professional summary",
  experience: "Experience structure",
  education: "Education structure",
  skills: "Skills discoverability",
  formatting: "Searchable ATS formatting",
  dates: "Date discoverability",
  optionalDepth: "Additional career depth",
};

function matches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

/**
 * Assess only text genuinely extracted from a source or generated document.
 * The same deterministic criteria are used for both sides of the comparison.
 */
export function assessExtractedResumeDocument(input: {
  text: string;
  pageCount: number | null;
  warnings?: { code: string }[];
}): DocumentAtsAssessment {
  const text = input.text.replace(/\r\n?/gu, "\n").trim();
  const meaningful = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (meaningful < 80) {
    return { status: "unavailable", findings: [
      "The document did not contain enough searchable text for a credible assessment.",
    ] };
  }

  const lower = text.toLocaleLowerCase("en");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const heading = (pattern: RegExp) => lines.some((line) => line.length <= 80 && pattern.test(line.toLocaleLowerCase("en")));
  const email = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u.test(text);
  const phone = /(?:\+?\d[\d\s().-]{7,}\d)/u.test(text);
  const linkedin = /(?:linkedin\.com|\blinkedin\b)/iu.test(text);
  const contactLabel = /\b(?:location|address|mobile|phone|email)\b/iu.test(text);
  const summaryHeading = heading(/^(?:professional\s+)?(?:summary|profile|objective|about)$/u);
  const experienceHeading = heading(/^(?:professional\s+|work\s+)?(?:experience|employment|career)(?:\s+history)?$/u);
  const educationHeading = heading(/^(?:education|academic\s+(?:background|qualifications)|qualifications)$/u);
  const skillsHeading = heading(/^(?:key\s+|core\s+|technical\s+)?(?:skills|competencies|expertise)$/u);
  const certificationHeading = heading(/^(?:certifications?|licenses?(?:\s+&\s+certifications?)?)$/u);
  const projectHeading = heading(/^(?:key\s+|selected\s+)?projects?$/u);
  const languageHeading = heading(/^languages?$/u);
  const dateCount = matches(text, /\b(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(?:19|20)\d{2}\b/giu);
  const actionLines = lines.filter((line) => /^(?:[•·▪◦*-]\s*)?(?:led|managed|created|built|delivered|developed|implemented|improved|increased|reduced|supported|coordinated|designed|achieved)\b/iu.test(line)).length;
  const degreeTerms = matches(lower, /\b(?:bachelor|master|degree|diploma|b\.?tech|m\.?tech|mba|phd|university|college|institute)\b/gu);
  const skillSeparators = matches(text, /[,|•·▪◦]/gu);
  const lowTextWarning = input.warnings?.some((warning) => warning.code === "low-text-page") ?? false;
  const standardHeadingCount = [summaryHeading, experienceHeading, educationHeading, skillsHeading].filter(Boolean).length;

  const breakdown: AtsScoreBreakdown[] = [];
  const add = (dimension: AtsScoreDimension, score: number, maximum: number, reason: string, suggestion?: string) => {
    breakdown.push({ dimension, label: LABELS[dimension], score, maximum, reason, ...(suggestion && score < maximum ? { suggestion } : {}) });
  };
  const contact = (email ? 5 : 0) + (phone ? 5 : 0) + (linkedin ? 2 : 0) + (contactLabel ? 3 : 0);
  add("contact", contact, 15, `${[email && "email", phone && "phone", linkedin && "LinkedIn", contactLabel && "contact labels"].filter(Boolean).join(", ") || "No standard contact markers"} detected in searchable text.`, "Add verified contact details in searchable text.");
  const summary = summaryHeading ? (meaningful >= 400 ? 10 : 6) : /\b(?:professional|career)\s+(?:summary|profile)\b/iu.test(text) ? 4 : 0;
  add("summary", summary, 10, summaryHeading ? "A recognizable summary section is present." : "No standard summary heading was detected.", "Use a standard summary heading and candidate-supplied content.");
  const experience = Math.min(25, (experienceHeading ? 8 : 0) + Math.min(8, dateCount * 2) + Math.min(9, actionLines * 3));
  add("experience", experience, 25, `${experienceHeading ? "Standard experience heading" : "No standard experience heading"}; ${dateCount} date markers and ${actionLines} action-led lines detected.`, "Use a standard experience heading and factual, action-led bullets.");
  const education = Math.min(10, (educationHeading ? 6 : 0) + Math.min(4, degreeTerms * 2));
  add("education", education, 10, `${educationHeading ? "Standard education heading" : "No standard education heading"}; ${degreeTerms} education markers detected.`, "Use a standard education heading where verified education is available.");
  const skills = Math.min(15, (skillsHeading ? 7 : 0) + (skillSeparators >= 8 ? 8 : skillSeparators >= 3 ? 5 : skillSeparators ? 2 : 0));
  add("skills", skills, 15, `${skillsHeading ? "Standard skills heading" : "No standard skills heading"}; ${skillSeparators} list separators detected.`, "Group verified skills under a standard skills heading.");
  const formatting = (meaningful >= 300 ? 5 : 3) + (standardHeadingCount >= 3 ? 3 : standardHeadingCount ? 1 : 0) + (!lowTextWarning ? 2 : 0);
  add("formatting", formatting, 10, `${meaningful} searchable letters/numbers, ${standardHeadingCount} standard section headings${lowTextWarning ? ", and a low-text page warning" : ""}.`, "Keep important content searchable and use conventional headings.");
  const dates = dateCount >= 2 ? 5 : dateCount === 1 ? 3 : 0;
  add("dates", dates, 5, `${dateCount} explicit year or month-year markers detected.`, "Use explicit, consistent dates where they are known.");
  const optional = (certificationHeading ? 4 : 0) + (projectHeading ? 3 : 0) + (languageHeading ? 3 : 0);
  add("optionalDepth", optional, 10, `${[certificationHeading && "certifications", projectHeading && "projects", languageHeading && "languages"].filter(Boolean).join(", ") || "No optional standard sections"} detected.`, "Include optional sections only when supported by verified facts.");

  const score = breakdown.reduce((total, item) => total + item.score, 0);
  const findings = breakdown.flatMap((item) => item.suggestion && item.score < item.maximum ? [item.suggestion] : []);
  if (input.pageCount) findings.push(`Assessment used searchable text extracted from ${input.pageCount} page${input.pageCount === 1 ? "" : "s"}.`);
  return { status: "ready", score, breakdown, findings };
}
