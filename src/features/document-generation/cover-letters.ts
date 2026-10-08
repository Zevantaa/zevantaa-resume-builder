import type { CoverLetterType } from "@/types/document-record";
import { V1_PACKAGE_DEFINITIONS } from "@/types/package";

import type { PdfBlock, PdfDocumentModel } from "./pdf/pdf-model";
import type { PdfThemeOverrides } from "./pdf/pdf-theme";
import type { DocumentData, DocumentDataMappingResult } from "./profile-mapper";

export const COVER_LETTER_TYPES = ["general-corporate", "international-relocation", "technology-startup"] as const satisfies readonly CoverLetterType[];

export const COVER_LETTER_LABELS: Record<CoverLetterType, string> = {
  "general-corporate": "General Corporate",
  "international-relocation": "International Relocation",
  "technology-startup": "Technology & Startup",
};

export function isCoverLetterType(value: unknown): value is CoverLetterType {
  return typeof value === "string" && COVER_LETTER_TYPES.some((type) => type === value);
}

export interface SourcedLetterParagraph { text: string; sourcePaths: string[] }
export interface CoverLetterContent {
  type: CoverLetterType;
  candidateName: string;
  contactLines: string[];
  salutation: "Dear Hiring Manager,";
  paragraphs: SourcedLetterParagraph[];
  signOff: "Sincerely,";
}
export interface CoverLetterOutput {
  content: CoverLetterContent;
  model: PdfDocumentModel;
  theme: PdfThemeOverrides;
}
export class CoverLetterNotReadyError extends Error {
  constructor() { super("The reviewed candidate profile or package is not ready for this cover letter."); }
}

const hasText = (value: string | undefined | null): value is string => Boolean(value?.trim());
const clean = (value: string): string => value.trim().replace(/\s+/gu, " ");
const sentence = (value: string): string => /[.!?]$/u.test(value.trim()) ? clean(value) : `${clean(value)}.`;
const list = (items: readonly string[]): string => items.length < 2 ? items.join("")
  : items.length === 2 ? `${items[0]} and ${items[1]}`
    : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;

/** The frozen scope explicitly grants all included outputs only to Executive All-Inclusive.
 * No other frozen package has a cover-letter configuration reference. */
export function isCoverLetterPackageEligible(data: DocumentData): boolean {
  const definition = V1_PACKAGE_DEFINITIONS.find((item) => item.code === data.packageContext.selectedPackage);
  return Boolean(definition?.isActive && definition.code === "executive-transition-agency-distribution");
}

function hasCredibleContext(data: DocumentData): boolean {
  const summary = data.professionalSummary?.text;
  return Boolean(
    (hasText(summary) && clean(summary).split(" ").length >= 7 && clean(summary).length >= 40) ||
    data.employment?.some((item) => hasText(item.jobTitle) && hasText(item.employerName)) ||
    data.projects?.some((item) => hasText(item.name) && hasText(item.description)) ||
    (data.education?.some((item) => hasText(item.qualification) && hasText(item.institutionName)) &&
      data.skills?.some((item) => hasText(item.name))),
  );
}

/** Choose an explicit current role, otherwise the most recent supplied start month. */
function recentRole(data: DocumentData) {
  const roles = data.employment ?? [];
  return roles.find((item) => item.currentRole) ?? [...roles]
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0];
}

function source(text: string, path: string): SourcedLetterParagraph {
  return { text: sentence(text), sourcePaths: [path] };
}
function combined(parts: SourcedLetterParagraph[]): SourcedLetterParagraph | null {
  return parts.length ? { text: parts.map((part) => part.text).join(" "),
    sourcePaths: [...new Set(parts.flatMap((part) => part.sourcePaths))] } : null;
}

function contactLines(data: DocumentData): string[] {
  const identity = data.identity;
  return [
    [identity.primaryEmail, identity.mobileNumber].filter(hasText).join(" | "),
    ...(identity.linkedinUrl ? [identity.linkedinUrl] : []),
    ...(identity.currentLocation ? [identity.currentLocation] : []),
  ].filter(hasText);
}

/** Deterministic prose assembled from reviewed facts, with paths to every factual source. */
export function buildCoverLetterContent(mapping: DocumentDataMappingResult, type: CoverLetterType): CoverLetterContent {
  const { data } = mapping;
  if (!isCoverLetterType(type) || !mapping.canGenerate || !isCoverLetterPackageEligible(data) ||
      !hasCredibleContext(data) || !hasText(data.identity.fullName) ||
      !hasText(data.identity.primaryEmail) || !hasText(data.identity.mobileNumber)) {
    throw new CoverLetterNotReadyError();
  }

  const openings: Record<CoverLetterType, string> = {
    "general-corporate": "I am writing to express interest in an opportunity with your organization.",
    "international-relocation": "I am writing to express interest in an international opportunity with your organization.",
    "technology-startup": "I am writing to express interest in a technology or startup opportunity with your organization.",
  };
  const paragraphs: SourcedLetterParagraph[] = [{ text: openings[type], sourcePaths: [] }];
  const background: SourcedLetterParagraph[] = [];
  if (data.professionalSummary?.text) background.push(source(data.professionalSummary.text, "professionalSummary.text"));
  const role = recentRole(data);
  if (role) {
    background.push(source(`My experience includes work as ${role.jobTitle} at ${role.employerName}${role.location ? ` in ${role.location}` : ""}`, `employment.${role.id}`));
    if (role.description) background.push(source(role.description, `employment.${role.id}.description`));
    if (role.highlights[0]) background.push(source(role.highlights[0], `employment.${role.id}.highlights.0`));
  }
  const firstBody = combined(background);
  if (firstBody) paragraphs.push(firstBody);

  const details: SourcedLetterParagraph[] = [];
  const skills = (data.skills ?? []).filter((item) => hasText(item.name)).slice(0, 4);
  if (skills.length) details.push({ text: sentence(`My skills include ${list(skills.map((item) => item.name))}`),
    sourcePaths: skills.map((item) => `skills.${item.id}.name`) });

  if (type === "general-corporate") {
    const education = data.education?.[0];
    if (education) details.push(source(`My education includes ${education.qualification} from ${education.institutionName}`, `education.${education.id}`));
    const certification = data.certifications?.[0];
    if (certification) details.push(source(`My profile also lists ${certification.name} from ${certification.issuingOrganization}`, `certifications.${certification.id}`));
  }
  if (type === "international-relocation") {
    const preference = data.identity.relocationPreference;
    if (preference === "open") details.push({
      text: sentence(`I am open to relocation${data.identity.currentLocation ? ` from ${data.identity.currentLocation}` : ""}`),
      sourcePaths: ["identity.relocationPreference", ...(data.identity.currentLocation ? ["identity.currentLocation"] : [])],
    });
    if (preference === "conditional") details.push({
      text: sentence(`My relocation preference is conditional${data.identity.currentLocation ? `; my current location is ${data.identity.currentLocation}` : ""}`),
      sourcePaths: ["identity.relocationPreference", ...(data.identity.currentLocation ? ["identity.currentLocation"] : [])],
    });
    const languages = (data.languages ?? []).filter((item) => hasText(item.name)).slice(0, 3);
    if (languages.length) details.push({ text: sentence(`The languages on my profile include ${list(languages.map((item) => item.name))}`),
      sourcePaths: languages.map((item) => `languages.${item.id}.name`) });
  }
  if (type === "technology-startup") {
    const project = data.projects?.find((item) => hasText(item.name));
    if (project) {
      details.push(source(`My project work includes ${project.name}${project.role ? `, with the role of ${project.role}` : ""}`, `projects.${project.id}`));
      if (project.description) details.push(source(project.description, `projects.${project.id}.description`));
      if (project.technologies.length) details.push({
        text: sentence(`Technologies explicitly listed for that project include ${list(project.technologies)}`),
        sourcePaths: project.technologies.map((_, index) => `projects.${project.id}.technologies.${index}`),
      });
    }
  }
  const secondBody = combined(details);
  if (secondBody) paragraphs.push(secondBody);
  paragraphs.push({ text: "I would welcome a conversation about a suitable opportunity. Thank you for your consideration.", sourcePaths: [] });
  return { type, candidateName: data.identity.fullName, contactLines: contactLines(data),
    salutation: "Dear Hiring Manager,", paragraphs, signOff: "Sincerely," };
}

/** All three variants share one restrained, selectable-text business-letter layout. */
export function buildCoverLetterModel(mapping: DocumentDataMappingResult, type: CoverLetterType): CoverLetterOutput {
  const content = buildCoverLetterContent(mapping, type);
  const blocks: PdfBlock[] = [
    { kind: "heading", level: 1, text: content.candidateName, keepWithNext: true },
    ...content.contactLines.map((text): PdfBlock => ({ kind: "paragraph", text, small: true })),
    { kind: "rule" },
    { kind: "paragraph", text: content.salutation, keepWithNext: true },
    ...content.paragraphs.map((item): PdfBlock => ({ kind: "paragraph", text: item.text })),
    { kind: "paragraph", text: content.signOff, keepWithNext: true },
    { kind: "paragraph", text: content.candidateName },
  ];
  return { content, model: { sourceProfileId: mapping.data.sourceProfileId,
    title: `${content.candidateName} - ${COVER_LETTER_LABELS[type]} Cover Letter`,
    sections: [{ id: "letter", blocks }] }, theme: {
      margins: { top: 55, right: 55, bottom: 55, left: 55 },
      typography: { bodySize: 10.2, smallSize: 8.7, heading1Size: 18, heading2Size: 11,
        lineHeight: 1.43, paragraphGap: 11, sectionGap: 1, bulletIndent: 12 },
      accentColor: "#274965", textColor: "#17263C", mutedColor: "#46566A",
    } };
}
