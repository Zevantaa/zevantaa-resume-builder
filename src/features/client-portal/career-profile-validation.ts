import { ADDITIONAL_ITEM_FIELDS, CAREER_FIELDS, CAREER_SECTION_NAMES,
  type CareerField, type CareerSection } from "./career-profile-model";
import { normalizeSkillName } from "./skill-name";

export type ValidatedRow = { key: string; [field: string]: string | boolean | string[] };
export type ValidatedCareer = { professionalSummary: string; additionalSections: {
  key: string; title: string; items: ValidatedRow[];
}[] } & Record<CareerSection, ValidatedRow[]>;

export class CareerValidationError extends Error {
  constructor(message: string) { super(message); this.name = "CareerValidationError"; }
}

const MONTH = /^(1[0-9]{3}|[2-9][0-9]{3})-(0[1-9]|1[0-2])$/;
const YEAR = /^(1[0-9]{3}|[2-9][0-9]{3})$/;
const DAY = /^(1[0-9]{3}|[2-9][0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const KEY = /^(?:existing-(?:0|[1-9][0-9]*)|new-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const PROFICIENCY = new Set(["", "basic", "conversational", "professional-working", "fluent", "native-or-bilingual"]);
const MAX_ROWS = 50;
const OPTIONAL_V8_FIELDS = new Set(["employmentType", "startYear", "endYear", "modeOfStudy", "issuedExactOn", "validityStatus", "expiresExactOn"]);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CareerValidationError("Review the career entries and try again.");
  return value as Record<string, unknown>;
}

function allowedKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new CareerValidationError("This form contains a field that cannot be changed here. Refresh and try again.");
  }
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new CareerValidationError(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new CareerValidationError(`${label} is too long (maximum ${max} characters).`);
  return trimmed;
}

function validUrl(value: string, label: string) {
  if (!value) return;
  try { const url = new URL(value); if (url.protocol === "http:" || url.protocol === "https:") return; }
  catch { /* A safe field-level error follows. */ }
  throw new CareerValidationError(`${label} must be a valid HTTP or HTTPS URL.`);
}

function validPeriod(start: string, end: string, label: string) {
  if (start && end && end < start) throw new CareerValidationError(`${label}: end date cannot precede start date.`);
}

function validateRow(raw: unknown, fields: CareerField[], label: string): ValidatedRow | null {
  const value = object(raw);
  allowedKeys(value, ["key", ...fields.map((field) => field.name)]);
  if (typeof value.key !== "string" || !KEY.test(value.key)) throw new CareerValidationError(`${label}: refresh and try again.`);
  const result: ValidatedRow = { key: value.key };
  let hasContent = false;
  for (const field of fields) {
    if (field.kind === "checkbox") {
      const checked = value[field.name] ?? (field.name === "currentStudy" || field.name === "ongoing" ? false : undefined);
      if (typeof checked !== "boolean") throw new CareerValidationError(`${label}: invalid current-role value.`);
      result[field.name] = checked;
      continue;
    }
    const content = text(value[field.name] ?? (OPTIONAL_V8_FIELDS.has(field.name) ? "" : undefined), `${label} — ${field.label}`, field.max ?? 200);
    if (content) hasContent = true;
    if (field.kind === "month" && content && !MONTH.test(content)) throw new CareerValidationError(`${label}: use a valid YYYY-MM month.`);
    if (field.kind === "year" && content && !YEAR.test(content)) throw new CareerValidationError(`${label}: use a valid four-digit year.`);
    if (field.kind === "day" && content && (!DAY.test(content) || Number.isNaN(new Date(`${content}T12:00:00Z`).valueOf()) ||
      new Date(`${content}T12:00:00Z`).toISOString().slice(0, 10) !== content)) throw new CareerValidationError(`${label}: use a valid YYYY-MM-DD date.`);
    if (field.kind === "url") validUrl(content, `${label} — ${field.label}`);
    if (field.kind === "proficiency" && !PROFICIENCY.has(content)) throw new CareerValidationError(`${label}: choose a listed proficiency or leave it blank.`);
    if (field.kind === "select" && content && !field.options?.some((option) => option.value === content))
      throw new CareerValidationError(`${label}: choose a listed ${field.label.toLowerCase()} or leave it blank.`);
    if (field.kind === "lines") {
      const lines = content.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 30 || lines.some((line) => line.length > 500)) throw new CareerValidationError(`${label}: too many or overly long list entries.`);
      result[field.name] = lines;
    } else result[field.name] = field.name === "name" && label.startsWith("Skills entry")
      ? normalizeSkillName(content).name : content;
  }
  if (!hasContent) return null;
  for (const field of fields) if (field.required && !result[field.name]) {
    throw new CareerValidationError(`${label}: ${field.label} is required.`);
  }
  return result;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ROWS) throw new CareerValidationError(`${label}: too many or invalid entries.`);
  return value;
}

function uniqueKeys(rows: ValidatedRow[], label: string) {
  if (new Set(rows.map((row) => row.key)).size !== rows.length) throw new CareerValidationError(`${label}: duplicate form entry. Refresh and try again.`);
}

function validateSection(raw: unknown, section: CareerSection): ValidatedRow[] {
  const label = CAREER_FIELDS[section].title;
  const rows = array(raw, label).flatMap((item, index) => {
    const row = validateRow(item, CAREER_FIELDS[section].fields, `${label} entry ${index + 1}`);
    return row ? [row] : [];
  });
  uniqueKeys(rows, label);
  for (const item of rows) {
    const start = String(item.startDate ?? "");
    const end = String(item.endDate ?? "");
    validPeriod(start, end, label);
    if (section === "workExperience" && item.currentRole === true && end) {
      throw new CareerValidationError("A current role cannot have an end month.");
    }
    if (section === "education" && item.completionYear && end) {
      throw new CareerValidationError("Education cannot have both a completion year and end month.");
    }
    if (section === "education") {
      if (item.currentStudy && (item.endDate || item.endYear || item.completionYear))
        throw new CareerValidationError("Current education cannot have an end or completion date.");
      if (item.startYear && item.endYear && String(item.endYear) < String(item.startYear))
        throw new CareerValidationError("Education end year cannot precede start year.");
      if (item.startYear && item.startDate || item.endYear && item.endDate)
        throw new CareerValidationError("Use either a year or month for each education date, not both.");
    }
    if (section === "certifications") {
      if ((item.issueYear && item.issuedOn) || (item.expiryYear && item.expiresOn) ||
        (item.issuedExactOn && (item.issuedOn || item.issueYear)) ||
        (item.expiresExactOn && (item.expiresOn || item.expiryYear))) {
        throw new CareerValidationError("Use either a year or month for each certification date, not both.");
      }
      if (item.validityStatus === "until-date" && !item.expiresExactOn)
        throw new CareerValidationError("Choose the exact expiry date for a date-limited certification.");
      if (item.validityStatus === "no-expiry" && (item.expiresExactOn || item.expiresOn || item.expiryYear))
        throw new CareerValidationError("A no-expiry certification cannot have an expiry date.");
      const issue = String(item.issuedExactOn || item.issuedOn || item.issueYear || "");
      const expiry = String(item.expiresExactOn || item.expiresOn || item.expiryYear || "");
      if (issue && expiry && expiry < issue.slice(0, expiry.length)) {
        throw new CareerValidationError("Certification expiry cannot precede issue date.");
      }
    }
    if (section === "projects" && item.ongoing === true && item.endDate)
      throw new CareerValidationError("An ongoing project cannot have an end month.");
  }
  if (section === "skills" || section === "languages") {
    const names = rows.map((item) => section === "skills" ? normalizeSkillName(String(item.name)).key : String(item.name).toLocaleLowerCase());
    if (new Set(names).size !== names.length) throw new CareerValidationError(`${label}: remove duplicate names.`);
  }
  return rows;
}

/** Strict allowlist: browser-supplied IDs, contact fields, package, and storage paths fail closed. */
export function validateCareerDraft(raw: unknown): ValidatedCareer {
  const value = object(raw);
  allowedKeys(value, ["professionalSummary", ...CAREER_SECTION_NAMES, "additionalSections"]);
  const professionalSummary = text(value.professionalSummary, "Professional summary", 10000);
  const sections = Object.fromEntries(CAREER_SECTION_NAMES.map((key) => [key, validateSection(value[key], key)])) as Record<CareerSection, ValidatedRow[]>;
  const additionalSections = array(value.additionalSections, "Additional information").flatMap((rawSection, index) => {
    const section = object(rawSection);
    allowedKeys(section, ["key", "title", "items"]);
    if (typeof section.key !== "string" || !KEY.test(section.key)) throw new CareerValidationError("Additional information: refresh and try again.");
    const title = text(section.title, "Additional section title", 200);
    const items = array(section.items, "Additional section entries").flatMap((item, itemIndex) => {
      const result = validateRow(item, ADDITIONAL_ITEM_FIELDS, `Additional entry ${itemIndex + 1}`);
      return result ? [result] : [];
    });
    uniqueKeys(items, "Additional section entries");
    if (!title && !items.length) return [];
    if (!title) throw new CareerValidationError(`Additional section ${index + 1} needs a title.`);
    return [{ key: section.key, title, items }];
  });
  if (new Set(additionalSections.map((section) => section.key)).size !== additionalSections.length) {
    throw new CareerValidationError("Additional information has duplicate sections.");
  }
  return { professionalSummary, ...sections, additionalSections };
}
