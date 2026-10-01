import type { PdfBlock, PdfDocumentModel, PdfSection } from "./pdf/pdf-model";
import type { DocumentDataFinding, DocumentDataMappingResult } from "./profile-mapper";

const hasText = (value: string | undefined | null): value is string => Boolean(value?.trim());
const joined = (values: readonly (string | undefined | null)[]) => values.filter(hasText).join(" | ");
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Change only the presentation of an explicit YYYY-MM value; never infer a month. */
function dateLabel(value: string | undefined): string | undefined {
  if (!hasText(value)) return undefined;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? `${months[Number(match[2]) - 1]} ${match[1]}` : value;
}

function dateRange(start?: string, end?: string, current = false): string | undefined {
  const from = dateLabel(start);
  const to = current ? "Present" : dateLabel(end);
  return from && to ? `${from} - ${to}` : from ?? to;
}

function paragraph(value: string | undefined, keepWithNext = false): PdfBlock[] {
  return hasText(value) ? [{ kind: "paragraph", text: value, keepWithNext }] : [];
}

/** Wrap only the presentation of a long URL; rejoining lines preserves every supplied character. */
function urlParagraphs(value: string | undefined): PdfBlock[] {
  if (!hasText(value)) return [];
  const lines: string[] = [];
  let remaining = value;
  while (remaining.length > 68) {
    const breakAt = Math.max(remaining.lastIndexOf("/", 68), remaining.lastIndexOf("-", 68));
    const length = breakAt >= 32 ? breakAt + 1 : 68;
    lines.push(remaining.slice(0, length));
    remaining = remaining.slice(length);
  }
  if (remaining) lines.push(remaining);
  return lines.map((line) => ({ kind: "paragraph", text: line, small: true }));
}

function bullets(values: readonly string[] | undefined): PdfBlock[] {
  const items = (values ?? []).filter(hasText);
  return items.length ? [{ kind: "bullets", items }] : [];
}

function section(id: string, title: string, blocks: PdfBlock[]): PdfSection[] {
  return blocks.length ? [{ id, title, blocks }] : [];
}

export class GlobalAtsResumeNotReadyError extends Error {
  readonly findings: readonly DocumentDataFinding[];

  constructor(findings: readonly DocumentDataFinding[]) {
    super("The reviewed candidate profile is not ready for Global ATS resume generation.");
    this.name = "GlobalAtsResumeNotReadyError";
    this.findings = findings;
  }
}

/** Pure, single-column ATS layout built only from the canonical mapper result. */
export function buildGlobalAtsResumeModel(mapping: DocumentDataMappingResult): PdfDocumentModel {
  const { data } = mapping;
  if (!mapping.canGenerate || !hasText(data.identity.fullName) ||
      !hasText(data.identity.primaryEmail) || !hasText(data.identity.mobileNumber) ||
      !hasText(data.packageContext.selectedPackage) || !data.packageContext.targetMarkets.length) {
    throw new GlobalAtsResumeNotReadyError(mapping.findings);
  }

  const primaryContact = joined([
    data.identity.primaryEmail,
    data.identity.mobileNumber,
    data.identity.whatsappNumber && `WhatsApp: ${data.identity.whatsappNumber}`,
  ]);
  const identity: PdfSection = { id: "identity", blocks: [
    { kind: "heading", level: 1, text: data.identity.fullName },
    ...paragraph(primaryContact),
    ...urlParagraphs(data.identity.linkedinUrl),
    ...paragraph(data.identity.currentLocation),
  ] };

  const employment = (data.employment ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: joined([item.jobTitle, item.employerName]) },
    ...paragraph(joined([item.location, dateRange(item.startDate, item.endDate, item.currentRole)])),
    ...paragraph(item.description),
    ...bullets(item.highlights),
  ]);
  const education = (data.education ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: joined([item.qualification, item.institutionName]) },
    ...paragraph(joined([
      item.fieldOfStudy, item.location,
      item.completionYear !== undefined ? String(item.completionYear) : dateRange(item.startDate, item.endDate),
      item.gradeResult && `Result: ${item.gradeResult}`,
    ])),
    ...bullets(item.highlights),
  ]);
  const certifications = (data.certifications ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: joined([item.name, item.issuingOrganization]) },
    ...paragraph(joined([
      item.issuedOn ? `Issued: ${dateLabel(item.issuedOn)}` : item.issueYear !== undefined ? `Issued: ${item.issueYear}` : undefined,
      item.expiresOn ? `Expires: ${dateLabel(item.expiresOn)}` : item.expiryYear !== undefined ? `Expires: ${item.expiryYear}` : undefined,
      item.credentialId && `Credential ID: ${item.credentialId}`,
      item.credentialUrl,
    ])),
  ]);
  const projects = (data.projects ?? []).flatMap((item): PdfBlock[] => [
    { kind: "heading", level: 2, text: item.name },
    ...paragraph(joined([item.role, dateRange(item.startDate, item.endDate), item.url])),
    ...paragraph(item.description),
    ...paragraph(item.technologies.length ? `Technologies: ${item.technologies.join(", ")}` : undefined),
    ...bullets(item.highlights),
  ]);
  const languages = (data.languages ?? []).map((item) =>
    item.proficiency ? `${item.name} (${item.proficiency.replaceAll("-", " ")})` : item.name);
  const additional = (data.additionalSections ?? []).flatMap((item) => section(
    `additional-${item.id}`, item.title,
    item.items.flatMap((entry): PdfBlock[] => [
      { kind: "heading", level: 2, text: entry.heading },
      ...paragraph(joined([entry.subheading, entry.dateLabel, entry.url])),
      ...paragraph(entry.description),
      ...bullets(entry.highlights),
    ]),
  ));

  return {
    sourceProfileId: data.sourceProfileId,
    title: `${data.identity.fullName} - Global ATS Resume`,
    sections: [
      identity,
      ...section("summary", "Professional Summary", paragraph(data.professionalSummary?.text)),
      ...section("experience", "Professional Experience", employment),
      ...section("education", "Education", education),
      ...section("skills", "Skills", bullets((data.skills ?? []).map((item) =>
        joined([item.name, item.category ? `(${item.category})` : undefined])))),
      ...section("certifications", "Certifications", certifications),
      ...section("projects", "Projects", projects),
      ...section("languages", "Languages", bullets(languages)),
      ...additional,
    ],
  };
}
