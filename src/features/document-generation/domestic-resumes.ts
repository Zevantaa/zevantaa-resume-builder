import type { EducationEntry, WorkExperienceEntry } from "@/types/client-profile";
import { packageAllowsOutput } from "./package-routing";

import type { PdfBlock, PdfDocumentModel, PdfSection } from "./pdf/pdf-model";
import type { PdfThemeOverrides } from "./pdf/pdf-theme";
import type { DocumentData, DocumentDataMappingResult } from "./profile-mapper";

export const DOMESTIC_DESIGNS = [
  { id: "1", name: "Executive Classic", description: "Traditional single-column executive presentation with ruled sections." },
  { id: "2", name: "Modern Professional", description: "A confident dark identity band and structured career entries." },
  { id: "3", name: "Compact High-Density", description: "Efficient typography and spacing for substantial career histories." },
  { id: "4", name: "Contemporary Sidebar", description: "A first-page two-zone profile with a clear main career flow." },
  { id: "5", name: "Premium Minimal", description: "Generous white space and restrained chronological hierarchy." },
] as const;
export type DomesticDesignId = typeof DOMESTIC_DESIGNS[number]["id"];
export const isDomesticDesignId = (value: string): value is DomesticDesignId =>
  DOMESTIC_DESIGNS.some((design) => design.id === value);

export interface DomesticResumeOutput { model: PdfDocumentModel; theme: PdfThemeOverrides }
const hasText = (value: string | undefined | null): value is string => Boolean(value?.trim());
const joined = (values: readonly (string | undefined | null)[], separator = " | ") => values.filter(hasText).join(separator);
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const date = (value?: string) => {
  if (!hasText(value)) return undefined;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? `${monthNames[Number(match[2]) - 1]} ${match[1]}` : value;
};
const range = (start?: string, end?: string, current = false) =>
  joined([date(start), current ? "Present" : date(end)], " – ");
const p = (value?: string, small = false): PdfBlock[] => hasText(value) ? [{ kind: "paragraph", text: value, small }] : [];
const bullets = (values: readonly string[] = []): PdfBlock[] => values.some(hasText) ?
  [{ kind: "bullets", items: values.filter(hasText) }] : [];
const section = (id: string, title: string, blocks: PdfBlock[], headingStyle: PdfSection["headingStyle"] = "plain"): PdfSection[] =>
  blocks.length ? [{ id, title, blocks, headingStyle }] : [];

/** Explicit line breaks keep a long supplied URL readable without inserting hyphens. */
function urlLines(value?: string, limit = 68): PdfBlock[] {
  if (!hasText(value)) return [];
  const lines: string[] = [];
  let remaining = value;
  while (remaining.length > limit) {
    const preferred = Math.max(remaining.lastIndexOf("/", limit), remaining.lastIndexOf("-", limit));
    const length = preferred >= Math.floor(limit / 2) ? preferred + 1 : limit;
    lines.push(remaining.slice(0, length));
    remaining = remaining.slice(length);
  }
  if (remaining) lines.push(remaining);
  return lines.map((text) => ({ kind: "paragraph", text, small: true }));
}

function contact(data: DocumentData, compact = false, urlLimit = 68): PdfBlock[] {
  const identity = data.identity;
  return [
    ...p(joined([identity.primaryEmail, identity.mobileNumber,
      identity.whatsappNumber ? `WhatsApp: ${identity.whatsappNumber}` : undefined]), compact),
    ...urlLines(identity.linkedinUrl, urlLimit),
    ...p(identity.currentLocation, compact),
  ];
}

function classicExperience(item: WorkExperienceEntry): PdfBlock[] {
  return [
    { kind: "heading", level: 2, text: joined([item.jobTitle, item.employerName]) },
    ...p(joined([item.location, range(item.startDate, item.endDate, item.currentRole)])),
    ...p(item.description), ...bullets(item.highlights),
  ];
}
function structuredExperience(item: WorkExperienceEntry): PdfBlock {
  return { kind: "entry", title: item.jobTitle, subtitle: item.employerName,
    date: range(item.startDate, item.endDate, item.currentRole), location: item.location,
    description: item.description, bullets: item.highlights };
}
function classicEducation(item: EducationEntry): PdfBlock[] {
  return [
    { kind: "heading", level: 2, text: joined([item.qualification, item.institutionName]) },
    ...p(joined([item.fieldOfStudy, item.location,
      item.completionYear !== undefined ? String(item.completionYear) : range(item.startDate, item.endDate),
      item.gradeResult ? `Result: ${item.gradeResult}` : undefined])),
    ...bullets(item.highlights),
  ];
}
function structuredEducation(item: EducationEntry): PdfBlock {
  return { kind: "entry", title: item.qualification, subtitle: item.institutionName,
    date: item.completionYear !== undefined ? String(item.completionYear) : range(item.startDate, item.endDate),
    location: joined([item.fieldOfStudy, item.location, item.gradeResult ? `Result: ${item.gradeResult}` : undefined]),
    bullets: item.highlights };
}
function certification(data: DocumentData): PdfBlock[] {
  return (data.certifications ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: joined([item.name, item.issuingOrganization]) },
    ...p(joined([
      item.issuedOn ? `Issued: ${date(item.issuedOn)}` : item.issueYear !== undefined ? `Issued: ${item.issueYear}` : undefined,
      item.expiresOn ? `Expires: ${date(item.expiresOn)}` : item.expiryYear !== undefined ? `Expires: ${item.expiryYear}` : undefined,
      item.credentialId ? `Credential ID: ${item.credentialId}` : undefined, item.credentialUrl,
    ])),
  ]);
}
function projects(data: DocumentData): PdfBlock[] {
  return (data.projects ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: item.name },
    ...p(joined([item.role, range(item.startDate, item.endDate), item.url])),
    ...p(item.description), ...p(item.technologies.length ? `Technologies: ${item.technologies.join(", ")}` : undefined),
    ...bullets(item.highlights),
  ]);
}
function languages(data: DocumentData): PdfBlock[] {
  return bullets((data.languages ?? []).map((item) =>
    item.proficiency ? `${item.name} (${item.proficiency.replaceAll("-", " ")})` : item.name));
}
function additional(data: DocumentData, style: PdfSection["headingStyle"]): PdfSection[] {
  return (data.additionalSections ?? []).flatMap((group) => section(`additional-${group.id}`, group.title,
    group.items.flatMap((item): PdfBlock[] => [
      { kind: "heading", level: 2, text: item.heading },
      ...p(joined([item.subheading, item.dateLabel, item.url])), ...p(item.description), ...bullets(item.highlights),
    ]), style));
}
function standardSections(data: DocumentData, style: PdfSection["headingStyle"], structured: boolean,
  compactSkills = false): PdfSection[] {
  const skills = (data.skills ?? []).map((item) => joined([item.name, item.category ? `(${item.category})` : undefined]));
  return [
    ...section("summary", "Professional Summary", p(data.professionalSummary?.text), style),
    ...section("experience", "Professional Experience", (data.employment ?? []).flatMap((item) =>
      structured ? [structuredExperience(item)] : classicExperience(item)), style),
    ...section("education", "Education", (data.education ?? []).flatMap((item) =>
      structured ? [structuredEducation(item)] : classicEducation(item)), style),
    ...section("skills", "Skills", compactSkills ? p(skills.join(" · ")) : bullets(skills), style),
    ...section("certifications", "Certifications", certification(data), style),
    ...section("projects", "Projects", projects(data), style),
    ...section("languages", "Languages", languages(data), style),
    ...additional(data, style),
  ];
}

export class DomesticResumeNotReadyError extends Error {
  constructor() { super("The reviewed candidate profile is not ready for a domestic resume."); }
}

export function isDomesticPackageEligible(data: DocumentData): boolean {
  return packageAllowsOutput(data.packageContext.selectedPackage, "domestic-resume-1");
}

function ready(mapping: DocumentDataMappingResult): DocumentData {
  const { data } = mapping;
  if (!mapping.canGenerate || !hasText(data.identity.fullName) || !hasText(data.identity.primaryEmail) ||
      !hasText(data.identity.mobileNumber) || !hasText(data.packageContext.selectedPackage) ||
      !data.packageContext.targetMarkets.length || !isDomesticPackageEligible(data)) throw new DomesticResumeNotReadyError();
  return data;
}
const model = (data: DocumentData, design: DomesticDesignId, sections: PdfSection[]): PdfDocumentModel => ({
  sourceProfileId: data.sourceProfileId, title: `${data.identity.fullName} - Domestic Resume ${design}`, sections,
});

/** Traditional ruled sections, complete single-column career narrative. */
export function buildDomesticResume1(data: DocumentData): DomesticResumeOutput {
  return { model: model(data, "1", [
    { id: "identity", blocks: [{ kind: "heading", level: 1, text: data.identity.fullName },
      ...contact(data), { kind: "rule" }] },
    ...standardSections(data, "ruled", false),
  ]), theme: { typography: { heading1Size: 20, heading2Size: 11, sectionGap: 14 },
    accentColor: "#0B132B" } };
}

/** Corporate identity band and compact, date-aligned entries. */
export function buildDomesticResume2(data: DocumentData): DomesticResumeOutput {
  const sections = standardSections(data, "accent", true).map((item): PdfSection =>
    item.id === "experience" && item.blocks[0]?.kind === "entry"
      ? { ...item, keepWithFirstEntry: true }
      : item);
  return { model: model(data, "2", [
    { id: "identity", blocks: [{ kind: "banner", title: data.identity.fullName }, ...contact(data)] },
    ...sections,
  ]), theme: { typography: { heading1Size: 20, heading2Size: 11, paragraphGap: 6, sectionGap: 15 },
    accentColor: "#123B50" } };
}

/** Smaller but still readable type, compact skills and efficient page rhythm. */
export function buildDomesticResume3(data: DocumentData): DomesticResumeOutput {
  return { model: model(data, "3", [
    { id: "identity", blocks: [{ kind: "heading", level: 1, text: data.identity.fullName }, ...contact(data, true)] },
    ...standardSections(data, "uppercase", true, true),
  ]), theme: { margins: { top: 32, right: 36, bottom: 32, left: 36 },
    typography: { bodySize: 9, smallSize: 8, heading1Size: 16, heading2Size: 10,
      lineHeight: 1.25, paragraphGap: 4, sectionGap: 9, bulletIndent: 11 }, accentColor: "#273449" } };
}

/** Bounded first-page two-zone profile; all later career entries flow full width. */
export function buildDomesticResume4(data: DocumentData): DomesticResumeOutput {
  const sidebar: PdfBlock[] = [
    { kind: "heading", level: 2, text: "Contact" }, ...contact(data, true, 32),
    ...(data.skills?.length ? [{ kind: "heading", level: 2, text: "Skills" } as const,
      ...bullets(data.skills.map((item) => joined([item.name, item.category ? `(${item.category})` : undefined])))] : []),
    ...(data.languages?.length ? [{ kind: "heading", level: 2, text: "Languages" } as const, ...languages(data)] : []),
  ];
  const main: PdfBlock[] = [
    ...(data.professionalSummary ? [{ kind: "heading", level: 2, text: "Professional Summary" } as const,
      ...p(data.professionalSummary.text)] : []),
    ...(data.certifications?.length ? [{ kind: "heading", level: 2, text: "Certifications" } as const,
      ...certification(data)] : []),
  ];
  return { model: model(data, "4", [
    { id: "identity", blocks: [{ kind: "banner", title: data.identity.fullName }] },
    { id: "profile-zones", blocks: [{ kind: "columns", left: sidebar, right: main }] },
    ...section("experience", "Professional Experience", (data.employment ?? []).map(structuredExperience), "accent"),
    ...section("education", "Education", (data.education ?? []).map(structuredEducation), "accent"),
    ...section("projects", "Projects", projects(data), "accent"),
    ...additional(data, "accent"),
  ]), theme: { margins: { left: 38, right: 38 },
    typography: { bodySize: 9.5, smallSize: 8, heading1Size: 19, heading2Size: 10.5,
      paragraphGap: 5, sectionGap: 12, bulletIndent: 10 }, accentColor: "#243B53" } };
}

/** Airy identity treatment and understated chronological entry rhythm. */
export function buildDomesticResume5(data: DocumentData): DomesticResumeOutput {
  return { model: model(data, "5", [
    { id: "identity", blocks: [{ kind: "heading", level: 1, text: data.identity.fullName },
      { kind: "rule" }, ...contact(data)] },
    ...standardSections(data, "plain", true),
  ]), theme: { margins: { top: 54, right: 54, bottom: 54, left: 54 },
    typography: { bodySize: 10, smallSize: 8.5, heading1Size: 25, heading2Size: 11,
      lineHeight: 1.45, paragraphGap: 8, sectionGap: 19, bulletIndent: 14 }, accentColor: "#394253" } };
}

/** The only public selection boundary for the five frozen domestic designs. */
export function buildDomesticResumeModel(mapping: DocumentDataMappingResult, design: DomesticDesignId): DomesticResumeOutput {
  const data = ready(mapping);
  switch (design) {
    case "1": return buildDomesticResume1(data);
    case "2": return buildDomesticResume2(data);
    case "3": return buildDomesticResume3(data);
    case "4": return buildDomesticResume4(data);
    case "5": return buildDomesticResume5(data);
  }
}
