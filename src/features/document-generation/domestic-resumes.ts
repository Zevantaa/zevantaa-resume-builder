import type { EducationEntry, WorkExperienceEntry } from "@/types/client-profile";
import { packageAllowsOutput } from "./package-routing";

import type { PdfBlock, PdfDocumentModel, PdfSection } from "./pdf/pdf-model";
import type { PdfThemeOverrides } from "./pdf/pdf-theme";
import type { DocumentData, DocumentDataMappingResult } from "./profile-mapper";

export const DOMESTIC_DESIGNS = [
  { id: "1", name: "Royal Navy & Gold Boardroom", description: "Board-level navy masthead, gold accents and executive competency grid." },
  { id: "2", name: "Contemporary Executive Sidebar", description: "Cyan-accented identity band with a bounded profile sidebar and full career flow." },
  { id: "3", name: "Editorial Prestige Masthead", description: "Editorial serif masthead, disciplined rules and high-density executive hierarchy." },
  { id: "4", name: "Split-Grid Executive", description: "Navy profile rail paired with a searchable, chronological main column." },
  { id: "5", name: "Executive Gold Accent", description: "Minimal white presentation with restrained gold rules and competency panels." },
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
  return lines.length ? [{ kind: "paragraph", text: lines.join("\n"), small: true }] : [];
}

function contact(data: DocumentData, compact = false, urlLimit = 68): PdfBlock[] {
  const identity = data.identity;
  if (compact) return [
    ...urlLines(identity.primaryEmail, urlLimit),
    ...p(joined([identity.mobileNumber,
      identity.whatsappNumber ? `WhatsApp: ${identity.whatsappNumber}` : undefined]), true),
    ...urlLines(identity.linkedinUrl, urlLimit),
    ...p(identity.currentLocation, true),
  ];
  return [
    ...p(joined([identity.primaryEmail, identity.mobileNumber,
      identity.whatsappNumber ? `WhatsApp: ${identity.whatsappNumber}` : undefined])),
    ...urlLines(identity.linkedinUrl, urlLimit),
    ...p(identity.currentLocation),
  ];
}

function headline(data: DocumentData): string | undefined {
  const current = data.employment?.find((item) => item.currentRole);
  return current?.jobTitle ?? data.employment?.[0]?.jobTitle;
}

function identityContactLines(data: DocumentData): string[] {
  return [
    joined([data.identity.currentLocation, data.identity.mobileNumber]),
    data.identity.primaryEmail,
    data.identity.linkedinUrl,
  ].filter(hasText);
}

function structuredExperience(item: WorkExperienceEntry): PdfBlock {
  return { kind: "entry", title: item.jobTitle, subtitle: item.employerName,
    date: range(item.startDate, item.endDate, item.currentRole), location: item.location,
    description: item.description, bullets: item.highlights };
}
function structuredEducation(item: EducationEntry): PdfBlock {
  return { kind: "entry", title: item.qualification, subtitle: item.institutionName,
    date: item.completionYear !== undefined ? String(item.completionYear) : range(item.startDate, item.endDate),
    location: joined([item.fieldOfStudy, item.location, item.gradeResult ? `Result: ${item.gradeResult}` : undefined]),
    bullets: item.highlights };
}
function certification(data: DocumentData, start = 0, end?: number): PdfBlock[] {
  return (data.certifications ?? []).slice(start, end).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: joined([item.name, item.issuingOrganization]) },
    ...p(joined([
      item.issuedOn ? `Issued: ${date(item.issuedOn)}` : item.issueYear !== undefined ? `Issued: ${item.issueYear}` : undefined,
      item.expiresOn ? `Expires: ${date(item.expiresOn)}` : item.expiryYear !== undefined ? `Expires: ${item.expiryYear}` : undefined,
      item.credentialId ? `Credential ID: ${item.credentialId}` : undefined, item.credentialUrl,
    ])),
  ]);
}
function projects(data: DocumentData): PdfBlock[] {
  return (data.projects ?? []).map((item): PdfBlock => ({
    kind: "entry",
    title: item.name,
    subtitle: item.role,
    date: range(item.startDate, item.endDate),
    location: item.url,
    description: joined([
      item.description,
      item.technologies.length ? `Technologies: ${item.technologies.join(", ")}` : undefined,
    ], "\n"),
    bullets: item.highlights,
    keepOpeningTogether: true,
  }));
}
function languages(data: DocumentData, start = 0, end?: number): PdfBlock[] {
  return bullets((data.languages ?? []).slice(start, end).map((item) =>
    item.proficiency ? `${item.name} (${item.proficiency.replaceAll("-", " ")})` : item.name));
}
function additional(data: DocumentData, style: PdfSection["headingStyle"]): PdfSection[] {
  return (data.additionalSections ?? []).flatMap((group) => section(`additional-${group.id}`, group.title,
    group.items.flatMap((item): PdfBlock[] => [
      { kind: "heading", level: 2, text: item.heading },
      ...p(joined([item.subheading, item.dateLabel, item.url])), ...p(item.description), ...bullets(item.highlights),
    ]), style));
}
function premiumSections(data: DocumentData, style: PdfSection["headingStyle"], tone: "plain" | "navy" | "gold",
  columns: 2 | 3 = 3): PdfSection[] {
  const skills = (data.skills ?? []).map((item) => joined([item.name, item.category ? `(${item.category})` : undefined]));
  return [
    ...section("summary", "Professional Summary", p(data.professionalSummary?.text), style),
    ...section("skills", "Core Skills & Competencies", skills.length ? [{ kind: "competency-grid", items: skills, columns, tone }] : [], style),
    ...section("experience", "Professional Experience", (data.employment ?? []).map(structuredExperience), style),
    ...section("education", "Education & Credentials", (data.education ?? []).map(structuredEducation), style),
    ...section("certifications", "Certifications", certification(data), style),
    ...section("projects", "Projects", projects(data), style),
    ...section("languages", "Languages", languages(data), style),
    ...additional(data, style),
  ];
}

function skillItems(data: DocumentData): string[] {
  return (data.skills ?? []).map((item) => joined([item.name, item.category ? `(${item.category})` : undefined]));
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

/** Approved Royal Navy & Gold Boardroom reference, mapped only to domestic slot 1. */
export function buildDomesticResume1(data: DocumentData): DomesticResumeOutput {
  return { model: model(data, "1", [
    { id: "identity", blocks: [{ kind: "premium-identity", style: "boardroom", name: data.identity.fullName,
      headline: headline(data), contact: identityContactLines(data) }] },
    ...premiumSections(data, "gold-rule", "gold", 3),
  ]), theme: { typography: { bodySize: 10, smallSize: 8.6, heading1Size: 22, heading2Size: 11,
    lineHeight: 1.38, paragraphGap: 5.5, sectionGap: 12 },
    accentColor: "#0F172A", secondaryAccentColor: "#D4AF37", surfaceColor: "#F8FAFC" } };
}

/** Approved Contemporary Executive Sidebar reference, with a bounded first-page rail. */
export function buildDomesticResume2(data: DocumentData): DomesticResumeOutput {
  const skills = skillItems(data);
  const sidebar: PdfBlock[] = [
    { kind: "heading", level: 2, text: "Contact" }, ...contact(data, true, 20),
  ];
  const profile: PdfBlock[] = [
    ...(skills.length ? [{ kind: "heading", level: 2, text: "Core Skills" } as const,
      { kind: "competency-grid", items: skills.slice(0, 6), columns: 2, tone: "plain" } as const] : []),
  ];
  const experience = section("experience", "Professional Experience", (data.employment ?? []).map(structuredExperience), "accent")
    .map((item): PdfSection => item.blocks[0]?.kind === "entry" ? { ...item, keepWithFirstEntry: true } : item);
  return { model: model(data, "2", [
    { id: "identity", blocks: [{ kind: "premium-identity", style: "executive-sidebar", name: data.identity.fullName,
      headline: headline(data), contact: identityContactLines(data) }] },
    ...(sidebar.length || profile.length ? [{ id: "profile-zones", blocks: [{ kind: "columns", left: sidebar,
      right: profile, variant: "sidebar" }] } as PdfSection] : []),
    ...section("summary", "Professional Summary", p(data.professionalSummary?.text), "accent"),
    ...section("additional-skills", "Additional Skills", skills.length > 6 ? [{ kind: "competency-grid",
      items: skills.slice(6), columns: 2, tone: "plain" }] : [], "accent"),
    ...experience,
    ...section("certifications", "Certifications", certification(data), "accent"),
    ...section("education", "Education", (data.education ?? []).map(structuredEducation), "accent"),
    ...section("projects", "Projects", projects(data), "accent"),
    ...section("languages", "Languages", languages(data), "accent"),
    ...additional(data, "accent"),
  ]), theme: { margins: { left: 38, right: 38 }, typography: { heading1Size: 21, heading2Size: 10.5,
    bodySize: 10, smallSize: 8.5, lineHeight: 1.36, paragraphGap: 5.5, sectionGap: 11, bulletIndent: 11 },
    accentColor: "#0F172A", secondaryAccentColor: "#0284C7", surfaceColor: "#F8FAFC" } };
}

/** Approved Editorial Prestige Masthead reference with serif display hierarchy. */
export function buildDomesticResume3(data: DocumentData): DomesticResumeOutput {
  return { model: model(data, "3", [
    { id: "identity", blocks: [{ kind: "premium-identity", style: "editorial-masthead", name: data.identity.fullName,
      headline: headline(data), contact: identityContactLines(data) }] },
    ...premiumSections(data, "editorial", "plain", 3),
  ]), theme: { margins: { top: 34, right: 40, bottom: 34, left: 40 },
    typography: { bodySize: 10.1, smallSize: 8.7, heading1Size: 22, heading2Size: 11,
      lineHeight: 1.38, paragraphGap: 5.5, sectionGap: 11, bulletIndent: 12 },
    accentColor: "#0F172A", secondaryAccentColor: "#C5A059", surfaceColor: "#F8FAFC" } };
}

/** Approved Split-Grid Executive reference; long career entries continue at readable full width. */
export function buildDomesticResume4(data: DocumentData): DomesticResumeOutput {
  const skills = skillItems(data);
  const experience = section("experience", "Professional Experience",
    (data.employment ?? []).map(structuredExperience), "editorial")
    .map((item): PdfSection => item.blocks[0]?.kind === "entry" ? { ...item, keepWithFirstEntry: true } : item);
  const sidebar: PdfBlock[] = [
    { kind: "heading", level: 1, text: data.identity.fullName },
    ...p(headline(data), true),
    { kind: "heading", level: 2, text: "Contact" }, ...contact(data, true, 24),
  ];
  const main: PdfBlock[] = [
    ...(skills.length ? [{ kind: "heading", level: 2, text: "Core Skills" } as const,
      { kind: "competency-grid", items: skills.slice(0, 6), columns: 2, tone: "plain" } as const] : []),
    ...(hasText(data.professionalSummary?.text) ? [
      { kind: "heading", level: 2, text: "Professional Summary" } as const,
      ...p(data.professionalSummary?.text),
    ] : []),
    ...((data.certifications ?? []).length ? [
      { kind: "heading", level: 2, text: "Certifications" } as const,
      ...certification(data, 0, 2),
    ] : []),
    ...((data.languages ?? []).length ? [
      { kind: "heading", level: 2, text: "Languages" } as const,
      ...languages(data, 0, 3),
    ] : []),
  ];
  return { model: model(data, "4", [
    { id: "profile-zones", blocks: [{ kind: "columns", left: sidebar, right: main, variant: "split-grid" }] },
    ...section("additional-skills", "Additional Skills", skills.length > 6 ? [{ kind: "competency-grid",
      items: skills.slice(6), columns: 2, tone: "plain" }] : [], "accent"),
    ...experience,
    ...section("certifications", "Additional Certifications", certification(data, 2), "accent"),
    ...section("education", "Education", (data.education ?? []).map(structuredEducation), "accent"),
    ...section("projects", "Projects", projects(data), "accent"),
    ...section("languages", "Additional Languages", languages(data, 3), "accent"),
    ...additional(data, "accent"),
  ]), theme: { margins: { top: 28, left: 36, right: 36, bottom: 30 },
    typography: { bodySize: 10, smallSize: 8.5, heading1Size: 19, heading2Size: 10.8,
      lineHeight: 1.3, paragraphGap: 4, sectionGap: 8, bulletIndent: 11 }, accentColor: "#0F172A",
    secondaryAccentColor: "#0284C7", surfaceColor: "#F8FAFC" } };
}

/** Approved Executive Gold Accent reference. */
export function buildDomesticResume5(data: DocumentData): DomesticResumeOutput {
  return { model: model(data, "5", [
    { id: "identity", blocks: [{ kind: "premium-identity", style: "gold-accent", name: data.identity.fullName,
      headline: headline(data), contact: identityContactLines(data) }] },
    ...premiumSections(data, "gold-rule", "gold", 2),
  ]), theme: { margins: { top: 44, right: 48, bottom: 44, left: 48 },
    typography: { bodySize: 10.1, smallSize: 8.6, heading1Size: 22, heading2Size: 11,
      lineHeight: 1.4, paragraphGap: 6, sectionGap: 13, bulletIndent: 12 }, accentColor: "#1A1A1A",
    secondaryAccentColor: "#C5A059", surfaceColor: "#FAF9F6" } };
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
