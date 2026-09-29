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
  "professional summary": "summary", "profile summary": "summary", summary: "summary", profile: "summary",
  "work experience": "employment", "professional experience": "employment", "employment history": "employment", experience: "employment",
  education: "education", "academic background": "education",
  skills: "skills", "core skills": "skills", "key skills": "skills", "technical skills": "skills", competencies: "skills",
  certifications: "certifications", certificates: "certifications",
  languages: "languages", "language skills": "languages",
  projects: "projects", "key projects": "projects",
  "additional information": "additional", "additional sections": "additional",
};
const months: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10", october: "10",
  nov: "11", november: "11", dec: "12", december: "12",
};
const proficiency: Record<string, string> = {
  basic: "basic", conversational: "conversational", "professional working": "professional-working",
  fluent: "fluent", native: "native-or-bilingual", bilingual: "native-or-bilingual", "native or bilingual": "native-or-bilingual",
};
const bullet = /^[•●▪◦*\-–]\s+/;
const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const withoutBullet = (value: string) => clean(value.replace(bullet, ""));
const parts = (value: string) => value.split("|").map(clean);
const headingOf = (value: string) => headings[value.trim().replace(/:$/, "").toLowerCase()];

function dateValue(value: string): { month?: string; year?: string } | null {
  const date = clean(value);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) return { month: date };
  if (/^\d{4}$/.test(date)) return { year: date };
  const match = date.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  const month = match && months[match[1].toLowerCase()];
  return month ? { month: `${match![2]}-${month}` } : null;
}

function dateRange(value: string): { startDate: string; endDate: string; isCurrentRole: string } | null {
  const match = clean(value).match(/^(.+?)\s+(?:-|–|—|to)\s+(.+)$/i);
  if (!match) return null;
  const start = dateValue(match[1]);
  const current = /^(present|current|ongoing|now)$/i.test(clean(match[2]));
  const end = current ? null : dateValue(match[2]);
  if (!start?.month || (!current && !end?.month) || (end && !end.month)) return null;
  if (end?.month && end.month < start.month) return null;
  return { startDate: start.month, endDate: end?.month ?? "", isCurrentRole: current ? "true" : "false" };
}

function parseEmployment(value: string): Record<string, string> | null {
  const fields = parts(value);
  if (fields.length !== 3 && fields.length !== 4) return null;
  const range = dateRange(fields.at(-1)!);
  if (!fields[0] || !fields[1] || !range || (fields.length === 4 && !fields[2])) return null;
  return { jobTitle: fields[0], employerName: fields[1], location: fields.length === 4 ? fields[2] : "", ...range, highlights: "", description: "" };
}

function parseEducation(value: string): Record<string, string> | null {
  const fields = parts(value);
  if (fields.length < 2 || fields.length > 4 || !fields[0] || !fields[1]) return null;
  let startDate = ""; let endDate = ""; let completionYear = ""; let gradeResult = "";
  for (const field of fields.slice(2)) {
    const range = field.match(/^(.+?)\s+(?:-|–|—|to)\s+(.+)$/i);
    const dates = range && [dateValue(range[1]), dateValue(range[2])];
    if (dates?.[0]?.month && dates[1]?.month && !startDate && !endDate && !completionYear) {
      startDate = dates[0].month; endDate = dates[1].month;
      if (endDate < startDate) return null;
    } else if (!range && dateValue(field) && !startDate && !endDate && !completionYear) {
      const date = dateValue(field)!;
      endDate = date.month ?? ""; completionYear = date.year ?? "";
    } else if (/^(CGPA|GPA|grade|result|percentage|score|class|classification)\s*:/i.test(field) && !gradeResult) {
      gradeResult = field;
    } else return null;
  }
  return { qualification: fields[0], institutionName: fields[1], startDate, endDate, completionYear, gradeResult };
}

function parseCertification(value: string): Record<string, string> | null {
  const fields = parts(value);
  if (fields.length < 2 || fields.length > 4 || !fields[0] || !fields[1]) return null;
  let issuedOn = ""; let issueYear = ""; let expiresOn = ""; let expiryYear = "";
  for (const field of fields.slice(2)) {
    const expiry = field.match(/^(?:expires?|expiry|valid until)\s*:\s*(.+)$/i);
    const date = dateValue(expiry ? expiry[1] : field);
    if (!date) return null;
    if (expiry && !expiresOn && !expiryYear) { expiresOn = date.month ?? ""; expiryYear = date.year ?? ""; }
    else if (!expiry && !issuedOn && !issueYear) { issuedOn = date.month ?? ""; issueYear = date.year ?? ""; }
    else return null;
  }
  return { name: fields[0], issuingOrganization: fields[1], issuedOn, issueYear, expiresOn, expiryYear };
}

function parseLanguages(value: string): { entries: Record<string, string>[]; unsupportedProficiency: boolean } {
  const result: Record<string, string>[] = [];
  let unsupportedProficiency = false;
  const tokens = withoutBullet(value).split(/[,;|]/).map(clean).filter(Boolean);
  for (let index = 0; index < tokens.length; index++) {
    const name = tokens[index];
    const explicit = tokens[index + 1]?.toLowerCase();
    if (explicit && proficiency[explicit]) { result.push({ name, proficiency: proficiency[explicit] }); index++; }
    else if (explicit && /\b(proficiency|working|intermediate|advanced|beginner|native speaker)\b/.test(explicit)) {
      result.push({ name, proficiency: "" }); unsupportedProficiency = true; index++;
    }
    else result.push({ name, proficiency: "" });
  }
  return { entries: result, unsupportedProficiency };
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
      if (!warnings.includes("Proposal limit reached; remaining source lines require manual review.")) warnings.push("Proposal limit reached; remaining source lines require manual review.");
      return null;
    }
    const proposal = { id: `${kind}:${proposals.length}`, section: kind, sourceLines, fields };
    proposals.push(proposal);
    return proposal;
  };
  const flush = () => {
    if (!section || !sectionLines.length) { sectionLines = []; return; }
    const meaningful = sectionLines.filter(({ value }) => clean(value));
    if (section === "summary") {
      if (meaningful.length) add(section, meaningful.map(({ line }) => line), { text: meaningful.map(({ value }) => clean(value)).join("\n") });
    } else if (section === "skills") {
      for (const { value, line } of meaningful) for (const item of withoutBullet(value).split(/[,;]+/)) {
        if (clean(item)) add(section, [line], { name: clean(item) });
      }
    } else if (section === "languages") {
      for (const { value, line } of meaningful) {
        const parsed = parseLanguages(value);
        for (const fields of parsed.entries) add(section, [line], fields);
        if (parsed.unsupportedProficiency) warnings.push(`languages line ${line}: unsupported proficiency remained only in source text.`);
      }
    } else if (section === "employment") {
      let current: ResumeReviewProposal | null = null;
      let unresolved = false;
      for (const { value, line } of meaningful) {
        if (bullet.test(value)) {
          if (current) {
            current.fields.highlights += `${current.fields.highlights ? "\n" : ""}${withoutBullet(value)}`;
            current.sourceLines.push(line);
          }
          continue;
        }
        const fields = parseEmployment(value);
        if (fields) {
          current = add(section, [line], fields);
          unresolved = false;
        } else {
          current = null;
          if (!unresolved) warnings.push(`employment line ${line}: header is incomplete or ambiguous; its bullets were left unresolved.`);
          unresolved = true;
        }
      }
    } else if (section === "education" || section === "certifications") {
      for (const { value, line } of meaningful) {
        if (bullet.test(value)) continue;
        const fields = section === "education" ? parseEducation(value) : parseCertification(value);
        if (fields) add(section, [line], fields);
        else warnings.push(`${section} line ${line}: ambiguous entry left unresolved.`);
      }
    } else if (section === "projects") {
      let current: ResumeReviewProposal | null = null;
      let boundary = true;
      for (const { value, line } of sectionLines) {
        // Mammoth puts blank lines between *every* paragraph. Only an explicit
        // Project: marker starts another project after the first title.
        if (!clean(value)) continue;
        if (bullet.test(value)) {
          if (current) {
            current.fields.highlights += `${current.fields.highlights ? "\n" : ""}${withoutBullet(value)}`;
            current.sourceLines.push(line);
          } else warnings.push(`projects line ${line}: bullet without a project title left unresolved.`);
          continue;
        }
        const explicit = value.match(/^project\s*:\s*(.+)$/i);
        if (boundary || explicit) {
          const name = clean(explicit?.[1] ?? value);
          if (name) current = add(section, [line], { name, description: "", highlights: "" });
          boundary = false;
        } else if (current) {
          current.fields.description += `${current.fields.description ? "\n" : ""}${clean(value)}`;
          current.sourceLines.push(line);
        }
      }
    } else if (section === "additional") {
      if (meaningful.length) add(section, meaningful.map(({ line }) => line), { heading: "Additional information", description: meaningful.map(({ value }) => withoutBullet(value)).join("\n") });
    }
    sectionLines = [];
  };
  lines.forEach((value, index) => {
    const next = headingOf(value);
    if (next) {
      flush();
      if (seen.has(next)) warnings.push(`Repeated ${next} heading at line ${index + 1}; entries remain separately reviewable.`);
      seen.add(next); section = next;
    } else if (section && /^[A-Z][A-Z &/]{2,40}:?$/.test(value.trim()) && value.trim().split(/\s+/).length <= 5) {
      flush(); warnings.push(`Unrecognized heading at line ${index + 1}; following text left unresolved.`); section = null;
    } else if (section) sectionLines.push({ value, line: index + 1 });
  });
  flush();
  if (!seen.size) warnings.push("No recognized section headings; no candidate facts were proposed.");
  for (const kind of ["employment", "education", "skills", "certifications"] as const) {
    if (!proposals.some((item) => item.section === kind)) warnings.push(`No unambiguous ${kind} entries were proposed.`);
  }
  return { proposals, warnings };
}
