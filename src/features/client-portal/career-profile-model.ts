import type { CandidateProfile } from "@/types/client-profile";

export type CareerRow = { key: string; [field: string]: string | boolean };
export type CareerSection = "workExperience" | "education" | "skills" | "certifications" | "languages" | "projects";
export type AdditionalDraftSection = { key: string; title: string; items: CareerRow[] };
export type CareerDraft = { professionalSummary: string; additionalSections: AdditionalDraftSection[] } &
  Record<CareerSection, CareerRow[]>;

export type CareerField = { name: string; label: string; kind?: "textarea" | "lines" | "month" | "year" | "day" | "url" | "checkbox" | "proficiency" | "select"; options?: readonly { value: string; label: string }[]; required?: boolean; max?: number };

export const CAREER_FIELDS: Record<CareerSection, { title: string; fields: CareerField[] }> = {
  workExperience: { title: "Work Experience", fields: [
    { name: "jobTitle", label: "Job title", required: true, max: 200 },
    { name: "employerName", label: "Employer", required: true, max: 200 },
    { name: "employmentType", label: "Employment type (optional)", kind: "select", options: [
      { value: "full-time", label: "Full-time" }, { value: "part-time", label: "Part-time" },
      { value: "contract", label: "Contract" }, { value: "internship", label: "Internship" },
      { value: "freelance", label: "Freelance" }, { value: "other", label: "Other" },
    ] },
    { name: "startDate", label: "Start month (optional)", kind: "month" },
    { name: "endDate", label: "End month", kind: "month" },
    { name: "currentRole", label: "Current role", kind: "checkbox" },
    { name: "location", label: "Role location", max: 200 },
    { name: "description", label: "Responsibilities", kind: "textarea", max: 4000 },
    { name: "highlights", label: "Highlights (one per line)", kind: "lines", max: 5000 },
  ] },
  education: { title: "Education", fields: [
    { name: "qualification", label: "Qualification", required: true, max: 200 },
    { name: "institutionName", label: "Institution", required: true, max: 200 },
    { name: "fieldOfStudy", label: "Field of study", max: 200 },
    { name: "startDate", label: "Start month", kind: "month" },
    { name: "endDate", label: "End month", kind: "month" },
    { name: "startYear", label: "Start year (optional)", kind: "year" },
    { name: "endYear", label: "End year (optional)", kind: "year" },
    { name: "currentStudy", label: "Currently studying here", kind: "checkbox" },
    { name: "modeOfStudy", label: "Mode of study (optional)", kind: "select", options: [
      { value: "offline", label: "Offline" }, { value: "online", label: "Online" },
      { value: "hybrid", label: "Hybrid" }, { value: "correspondence", label: "Correspondence" },
    ] },
    { name: "completionYear", label: "Completion year (if no end month)", kind: "year" },
    { name: "location", label: "Location", max: 200 },
    { name: "gradeResult", label: "Grade or result (as supplied)", max: 200 },
    { name: "highlights", label: "Details (one per line)", kind: "lines", max: 5000 },
  ] },
  skills: { title: "Skills", fields: [
    { name: "name", label: "Skill", required: true, max: 200 },
    { name: "category", label: "Category", max: 100 },
  ] },
  certifications: { title: "Certifications", fields: [
    { name: "name", label: "Certification", required: true, max: 200 },
    { name: "issuingOrganization", label: "Issuing organization", required: true, max: 200 },
    { name: "issuedOn", label: "Issue month", kind: "month" },
    { name: "issueYear", label: "Issue year (if no month)", kind: "year" },
    { name: "issuedExactOn", label: "Exact issue date (if supplied)", kind: "day" },
    { name: "validityStatus", label: "Validity (optional)", kind: "select", options: [
      { value: "until-date", label: "Valid until a date" }, { value: "no-expiry", label: "No expiry / valid forever" },
      { value: "unknown", label: "Unknown / not provided" },
    ] },
    { name: "expiresOn", label: "Expiry month", kind: "month" },
    { name: "expiryYear", label: "Expiry year (if no month)", kind: "year" },
    { name: "expiresExactOn", label: "Valid until (exact date)", kind: "day" },
    { name: "credentialId", label: "Credential ID", max: 200 },
    { name: "credentialUrl", label: "Credential URL", kind: "url", max: 1000 },
  ] },
  languages: { title: "Languages", fields: [
    { name: "name", label: "Language", required: true, max: 100 },
    { name: "proficiency", label: "Proficiency (only if supplied)", kind: "proficiency" },
  ] },
  projects: { title: "Projects", fields: [
    { name: "name", label: "Project title", required: true, max: 200 },
    { name: "role", label: "Role", max: 200 },
    { name: "startDate", label: "Start month", kind: "month" },
    { name: "endDate", label: "End month", kind: "month" },
    { name: "ongoing", label: "Project is ongoing", kind: "checkbox" },
    { name: "description", label: "Description", kind: "textarea", max: 4000 },
    { name: "highlights", label: "Highlights (one per line)", kind: "lines", max: 5000 },
    { name: "technologies", label: "Technologies (one per line)", kind: "lines", max: 3000 },
    { name: "url", label: "Project URL", kind: "url", max: 1000 },
  ] },
};

export const ADDITIONAL_ITEM_FIELDS: CareerField[] = [
  { name: "heading", label: "Entry heading", required: true, max: 200 },
  { name: "subheading", label: "Subheading", max: 200 },
  { name: "dateLabel", label: "Date label (as supplied)", max: 100 },
  { name: "description", label: "Description", kind: "textarea", max: 4000 },
  { name: "highlights", label: "Highlights (one per line)", kind: "lines", max: 5000 },
  { name: "url", label: "URL", kind: "url", max: 1000 },
];

export const CAREER_SECTION_NAMES = Object.keys(CAREER_FIELDS) as CareerSection[];
const lines = (value: string[]) => value.join("\n");
const row = (index: number, fields: Record<string, string | boolean>): CareerRow => ({ key: `existing-${index}`, ...fields });

/** Only editable career facts leave the server; internal row and profile IDs stay server-side. */
export function toCareerDraft(profile: CandidateProfile): CareerDraft {
  return {
    professionalSummary: profile.professionalSummary ?? "",
    workExperience: profile.workExperience.map((v, i) => row(i, { jobTitle: v.jobTitle, employerName: v.employerName,
      startDate: v.startDate ?? "", endDate: v.endDate ?? "", currentRole: v.currentRole,
      employmentType: v.employmentType ?? "", location: v.location ?? "",
      description: v.description ?? "", highlights: lines(v.highlights) })),
    education: profile.education.map((v, i) => row(i, { qualification: v.qualification,
      institutionName: v.institutionName, fieldOfStudy: v.fieldOfStudy ?? "", startDate: v.startDate ?? "",
      endDate: v.endDate ?? "", startYear: v.startYear?.toString() ?? "", endYear: v.endYear?.toString() ?? "",
      currentStudy: v.currentStudy ?? false, modeOfStudy: v.modeOfStudy ?? "",
      completionYear: v.completionYear?.toString() ?? "", location: v.location ?? "",
      gradeResult: v.gradeResult ?? "", highlights: lines(v.highlights) })),
    skills: profile.skills.map((v, i) => row(i, { name: v.name, category: v.category ?? "" })),
    certifications: profile.certifications.map((v, i) => row(i, { name: v.name,
      issuingOrganization: v.issuingOrganization, issuedOn: v.issuedOn ?? "", issueYear: v.issueYear?.toString() ?? "",
      issuedExactOn: v.issuedExactOn ?? "", validityStatus: v.validityStatus ?? "",
      expiresOn: v.expiresOn ?? "", expiryYear: v.expiryYear?.toString() ?? "", expiresExactOn: v.expiresExactOn ?? "",
      credentialId: v.credentialId ?? "",
      credentialUrl: v.credentialUrl ?? "" })),
    languages: profile.languages.map((v, i) => row(i, { name: v.name, proficiency: v.proficiency ?? "" })),
    projects: profile.projects.map((v, i) => row(i, { name: v.name, role: v.role ?? "",
      startDate: v.startDate ?? "", endDate: v.endDate ?? "", ongoing: v.ongoing ?? false,
      description: v.description ?? "",
      highlights: lines(v.highlights), technologies: lines(v.technologies), url: v.url ?? "" })),
    additionalSections: profile.additionalSections.map((section, i) => ({ key: `existing-${i}`, title: section.title,
      items: section.items.map((item, j) => row(j, { heading: item.heading, subheading: item.subheading ?? "",
        dateLabel: item.dateLabel ?? "", description: item.description ?? "", highlights: lines(item.highlights),
        url: item.url ?? "" })) })),
  };
}
