/** Deterministic proposals only. Nothing here writes to the canonical profile. */
export type ReviewSection = "summary" | "employment" | "education" | "skills" | "certifications" | "languages" | "projects" | "additional";
export interface ResumeReviewProposal {
  id: string;
  section: ReviewSection;
  sourceLines: number[];
  fields: Record<string, string>;
}
export interface ResumeReviewDraft {
  proposals: ResumeReviewProposal[];
  warnings: string[];
}

const headings: Record<string, ReviewSection> = {
  "professional summary": "summary", "profile summary": "summary", "summary": "summary",
  "work experience": "employment", "professional experience": "employment", "employment history": "employment", "experience": "employment",
  "education": "education", "academic background": "education",
  "skills": "skills", "key skills": "skills", "technical skills": "skills",
  "certifications": "certifications", "certificates": "certifications",
  "languages": "languages", "language skills": "languages",
  "projects": "projects", "key projects": "projects",
  "additional information": "additional", "additional sections": "additional",
};
const month = "\\d{4}-(?:0[1-9]|1[0-2])";
const employmentPattern = new RegExp(`^(.+?)\\s*\\|\\s*(.+?)\\s*\\|\\s*(${month})\\s*(?:[-–—]|to)\\s*(${month}|present|current)$`, "i");
const educationPattern = new RegExp(`^(.+?)\\s*\\|\\s*(.+?)(?:\\s*\\|\\s*(${month})(?:\\s*(?:[-–—]|to)\\s*(${month}))?)?$`, "i");
const certificationPattern = new RegExp(`^(.+?)\\s*\\|\\s*(.+?)(?:\\s*\\|\\s*(${month})(?:\\s*(?:[-–—]|to)\\s*(${month}))?)?$`, "i");

function clean(value: string): string { return value.trim().replace(/\s+/g, " "); }
function headingOf(value: string): ReviewSection | undefined {
  return headings[value.trim().replace(/:$/, "").toLowerCase()];
}

export function parseResumeReview(text: string): ResumeReviewDraft {
  const proposals: ResumeReviewProposal[] = [];
  const warnings: string[] = [];
  const lines = text.split(/\n/);
  let section: ReviewSection | null = null;
  let sectionLines: { value: string; line: number }[] = [];
  const seen = new Set<ReviewSection>();
  const add = (kind: ReviewSection, sourceLines: number[], fields: Record<string, string>) => {
    if (proposals.length >= 200) {
      if (!warnings.includes("Proposal limit reached; remaining source lines require manual review."))
        warnings.push("Proposal limit reached; remaining source lines require manual review.");
      return;
    }
    proposals.push({ id: `${kind}:${proposals.length}`, section: kind, sourceLines, fields });
  };
  const flush = () => {
    if (!section || !sectionLines.length) { sectionLines = []; return; }
    const meaningful = sectionLines.filter(({ value }) => clean(value));
    if (section === "summary") {
      if (meaningful.length) add(section, meaningful.map((line) => line.line), { text: meaningful.map((line) => clean(line.value)).join("\n") });
    } else if (section === "skills" || section === "languages") {
      for (const { value, line } of meaningful) {
        for (const item of value.replace(/^[•*\-]\s*/, "").split(/[,;]+/)) {
          const name = clean(item);
          if (name) add(section, [line], { name });
        }
      }
    } else if (section === "employment" || section === "education" || section === "certifications") {
      for (const { value, line } of meaningful) {
        const match = value.match(section === "employment" ? employmentPattern : section === "education" ? educationPattern : certificationPattern);
        if (!match) { warnings.push(`${section} line ${line}: ambiguous entry left unresolved.`); continue; }
        const first = clean(match[1]); const second = clean(match[2]);
        if (!first || !second || first.includes("|") || second.includes("|")) {
          warnings.push(`${section} line ${line}: incomplete or ambiguous entry left unresolved.`);
          continue;
        }
        if (section === "employment") add(section, [line], { jobTitle: first, employerName: second, startDate: match[3], endDate: /^(present|current)$/i.test(match[4]) ? "" : match[4], isCurrentRole: /^(present|current)$/i.test(match[4]) ? "true" : "false" });
        if (section === "education") add(section, [line], { qualification: first, institutionName: second, startDate: match[3] ?? "", endDate: match[4] ?? "" });
        if (section === "certifications") add(section, [line], { name: first, issuingOrganization: second, issuedOn: match[3] ?? "", expiresOn: match[4] ?? "" });
      }
    } else if (section === "projects" || section === "additional") {
      for (const { value, line } of meaningful) {
        if (section === "projects") {
          const match = value.match(/^(?:project\s*:\s*|[•*\-]\s+)(.+)$/i);
          if (match && clean(match[1])) add(section, [line], { name: clean(match[1]) });
          else warnings.push(`projects line ${line}: project name not explicit; left unresolved.`);
        } else {
          const heading = clean(value.replace(/^[•*\-]\s*/, ""));
          if (heading) add(section, [line], { heading });
        }
      }
    }
    sectionLines = [];
  };
  lines.forEach((value, index) => {
    const nextSection = headingOf(value);
    if (nextSection) {
      flush();
      if (seen.has(nextSection)) warnings.push(`Repeated ${nextSection} heading at line ${index + 1}; entries remain separately reviewable.`);
      seen.add(nextSection); section = nextSection;
    } else if (/^[A-Z][A-Z &/]{2,40}:?$/.test(value.trim()) && value.trim().split(/\s+/).length <= 5) {
      flush();
      warnings.push(`Unrecognized heading at line ${index + 1}; following text left unresolved.`);
      section = null;
    } else if (section) {
      sectionLines.push({ value, line: index + 1 });
    }
  });
  flush();
  if (!seen.size) warnings.push("No recognized section headings; no candidate facts were proposed.");
  for (const kind of ["employment", "education", "skills", "certifications"] as const) {
    if (!proposals.some((item) => item.section === kind)) warnings.push(`No unambiguous ${kind} entries were proposed.`);
  }
  return { proposals, warnings };
}
