import { V1_PACKAGE_DEFINITIONS } from "@/types/package";
import type { EducationEntry, WorkExperienceEntry } from "@/types/client-profile";

import type { PdfBlock, PdfDocumentModel, PdfSection } from "./pdf/pdf-model";
import type { PdfThemeOverrides } from "./pdf/pdf-theme";
import type { DocumentData, DocumentDataMappingResult } from "./profile-mapper";

export interface EuropeanResumeOutput { model: PdfDocumentModel; theme: PdfThemeOverrides }
export class EuropeanResumeNotReadyError extends Error {
  constructor() { super("The reviewed candidate profile or package is not ready for a European resume."); }
}

const hasText = (value: string | undefined | null): value is string => Boolean(value?.trim());
const joined = (values: readonly (string | undefined | null)[], separator = " | ") => values.filter(hasText).join(separator);
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const date = (value?: string) => {
  if (!hasText(value)) return undefined;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? `${months[Number(match[2]) - 1]} ${match[1]}` : value;
};
const range = (start?: string, end?: string, current = false) =>
  joined([date(start), current ? "Present" : date(end)], " - ");
const paragraph = (value?: string, small = false): PdfBlock[] =>
  hasText(value) ? [{ kind: "paragraph", text: value, small }] : [];
const bullets = (items: readonly string[] = []): PdfBlock[] =>
  items.some(hasText) ? [{ kind: "bullets", items: items.filter(hasText) }] : [];
const section = (id: string, title: string, blocks: PdfBlock[]): PdfSection[] =>
  blocks.length ? [{ id, title, blocks, headingStyle: "ruled",
    ...(blocks[0]?.kind === "entry" ? { keepWithFirstEntry: true } : {}) }] : [];

/** Break a long link only for page layout; the underlying characters are unchanged. */
function linkLines(value?: string): string[] {
  if (!hasText(value)) return [];
  const lines: string[] = [];
  let remaining = value;
  while (remaining.length > 58) {
    const boundary = Math.max(remaining.lastIndexOf("/", 58), remaining.lastIndexOf("-", 58));
    const length = boundary >= 25 ? boundary + 1 : 58;
    lines.push(remaining.slice(0, length));
    remaining = remaining.slice(length);
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function employment(item: WorkExperienceEntry): PdfBlock {
  return { kind: "entry", title: item.jobTitle, subtitle: item.employerName,
    date: range(item.startDate, item.endDate, item.currentRole), location: item.location,
    description: item.description, bullets: item.highlights,
    keepTogether: false, keepOpeningTogether: true };
}
function education(item: EducationEntry): PdfBlock {
  return { kind: "entry", title: item.qualification, subtitle: item.institutionName,
    date: item.completionYear !== undefined ? String(item.completionYear) : range(item.startDate, item.endDate),
    location: joined([item.fieldOfStudy, item.location, item.gradeResult ? `Result: ${item.gradeResult}` : undefined]),
    bullets: item.highlights, keepTogether: false, keepOpeningTogether: true };
}

export function isEuropeanPackageEligible(data: DocumentData): boolean {
  const definition = V1_PACKAGE_DEFINITIONS.find((item) => item.code === data.packageContext.selectedPackage);
  return Boolean(definition?.isActive && definition.resumeFormatFamilies.some((family) => family === "europass-european-union"));
}

/** Pure presentation of reviewed canonical data; never queries storage or creates candidate facts. */
export function buildEuropeanResumeModel(mapping: DocumentDataMappingResult): EuropeanResumeOutput {
  const { data } = mapping;
  if (!mapping.canGenerate || !hasText(data.identity.fullName) || !hasText(data.identity.primaryEmail) ||
      !hasText(data.identity.mobileNumber) || !data.packageContext.targetMarkets.length ||
      !isEuropeanPackageEligible(data)) throw new EuropeanResumeNotReadyError();

  const relocation = {
    open: "Relocation preference: Open",
    conditional: "Relocation preference: Conditional",
    "not-open": "Relocation preference: Not open",
    "not-specified": undefined,
  }[data.identity.relocationPreference];
  const identity: PdfSection = { id: "identity", blocks: [{ kind: "european-identity",
    name: data.identity.fullName,
    contact: [data.identity.primaryEmail, data.identity.mobileNumber,
      ...(data.identity.whatsappNumber ? [`WhatsApp: ${data.identity.whatsappNumber}`] : []),
      ...linkLines(data.identity.linkedinUrl)].filter(hasText),
    context: [data.identity.currentLocation ? `Current location: ${data.identity.currentLocation}` : undefined,
      relocation].filter(hasText),
  }] };
  const certifications = (data.certifications ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: joined([item.name, item.issuingOrganization]) },
    ...paragraph(joined([
      item.issuedOn ? `Issued: ${date(item.issuedOn)}` : item.issueYear !== undefined ? `Issued: ${item.issueYear}` : undefined,
      item.expiresOn ? `Expires: ${date(item.expiresOn)}` : item.expiryYear !== undefined ? `Expires: ${item.expiryYear}` : undefined,
      item.credentialId ? `Credential ID: ${item.credentialId}` : undefined,
      item.credentialUrl,
    ]), true),
  ]);
  const projects = (data.projects ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: item.name },
    ...paragraph(joined([item.role, range(item.startDate, item.endDate), item.url]), true),
    ...paragraph(item.description),
    ...paragraph(item.technologies.length ? `Technologies: ${item.technologies.join(", ")}` : undefined, true),
    ...bullets(item.highlights),
  ]);
  const additional = (data.additionalSections ?? []).flatMap((group) => section(
    `additional-${group.id}`, group.title,
    group.items.flatMap((item): PdfBlock[] => [
      { kind: "heading", level: 2, text: item.heading },
      ...paragraph(joined([item.subheading, item.dateLabel, item.url]), true),
      ...paragraph(item.description), ...bullets(item.highlights),
    ]),
  ));
  return { model: { sourceProfileId: data.sourceProfileId,
    title: `${data.identity.fullName} - European Resume`, sections: [
      identity,
      ...section("summary", "Professional Profile", paragraph(data.professionalSummary?.text)),
      ...section("experience", "Work Experience", (data.employment ?? []).map(employment)),
      ...section("education", "Education and Training", (data.education ?? []).map(education)),
      ...section("skills", "Skills", bullets((data.skills ?? []).map((item) =>
        joined([item.name, item.category ? `(${item.category})` : undefined])))),
      ...section("languages", "Languages", bullets((data.languages ?? []).map((item) =>
        item.proficiency ? `${item.name} (${item.proficiency.replaceAll("-", " ")})` : item.name))),
      ...section("certifications", "Certifications", certifications),
      ...section("projects", "Projects", projects),
      ...additional,
    ] }, theme: {
      margins: { top: 44, right: 44, bottom: 44, left: 44 },
      typography: { bodySize: 9.5, smallSize: 8.4, heading1Size: 20, heading2Size: 11,
        lineHeight: 1.34, paragraphGap: 5.5, sectionGap: 12, bulletIndent: 12 },
      accentColor: "#274965", textColor: "#17263C", mutedColor: "#46566A",
    } };
}
