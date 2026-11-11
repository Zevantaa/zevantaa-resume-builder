import type { CoverLetterType } from "@/types/document-record";
import { packageAllowsOutput } from "./package-routing";

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
/** Use supplied prose whole or omit it: truncating a clause could reverse its meaning. */
function conciseSupplied(value: string | undefined, maxLength: number): string | undefined {
  if (!hasText(value)) return undefined;
  const normalized = clean(value);
  if (normalized.length > maxLength || /candidate[\s-]+supplied/iu.test(normalized)) return undefined;
  return sentence(normalized);
}

/** The frozen scope explicitly grants all included outputs only to Executive All-Inclusive.
 * No other frozen package has a cover-letter configuration reference. */
export function isCoverLetterPackageEligible(data: DocumentData): boolean {
  return packageAllowsOutput(data.packageContext.selectedPackage, "general-corporate-cover-letter");
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

/** Choose the most recent reviewed role; current roles win only when still current. */
function recentRole(data: DocumentData) {
  const roles = data.employment ?? [];
  return [...roles].sort((a, b) => Number(b.currentRole) - Number(a.currentRole) ||
    (b.startDate ?? "").localeCompare(a.startDate ?? "") || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0];
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
    "general-corporate": "I am writing regarding a professional opportunity with your organization.",
    "international-relocation": "I am writing regarding an international opportunity with your organization.",
    "technology-startup": "I am writing regarding a technology or startup opportunity with your organization.",
  };
  const paragraphs: SourcedLetterParagraph[] = [{ text: openings[type], sourcePaths: [] }];
  const role = recentRole(data);
  const skills = (data.skills ?? []).filter((item) => hasText(item.name) && clean(item.name).length <= 60 &&
    !/candidate[\s-]+supplied/iu.test(item.name)).slice(0, 3);
  if (role) {
    const skillClause = skills.length ? `, alongside work involving ${list(skills.map((item) => item.name))}` : "";
    const main: SourcedLetterParagraph[] = [{
      text: sentence(`My background includes experience as ${role.jobTitle} with ${role.employerName}${skillClause}`),
      sourcePaths: [`employment.${role.id}`, ...skills.map((item) => `skills.${item.id}.name`)],
    }];
    const evidence = conciseSupplied(role.description, 160);
    const highlight = evidence ? undefined : role.highlights.find((item) => conciseSupplied(item, 160));
    if (evidence) main.push({ text: evidence, sourcePaths: [`employment.${role.id}.description`] });
    else if (highlight) main.push({ text: conciseSupplied(highlight, 160)!,
      sourcePaths: [`employment.${role.id}.highlights.${role.highlights.indexOf(highlight)}`] });
    const firstBody = combined(main);
    if (firstBody) paragraphs.push(firstBody);
  } else if (skills.length) {
    paragraphs.push({ text: sentence(`My skills include ${list(skills.map((item) => item.name))}`),
      sourcePaths: skills.map((item) => `skills.${item.id}.name`) });
  }

  const details: SourcedLetterParagraph[] = [];
  const summary = conciseSupplied(data.professionalSummary?.text, 560);
  if (summary) details.push({ text: summary, sourcePaths: ["professionalSummary.text"] });

  if (type === "general-corporate") {
    const education = data.education?.[0];
    const certification = data.certifications?.[0];
    const educationText = education && clean(education.qualification).length + clean(education.institutionName).length <= 125
      ? `My education includes ${education.qualification} from ${education.institutionName}` : undefined;
    const certificationText = certification && clean(certification.name).length + clean(certification.issuingOrganization).length <= 125
      ? `${educationText ? "my" : "My"} certifications include ${certification.name} from ${certification.issuingOrganization}` : undefined;
    if (educationText || certificationText) details.push({
      text: sentence([educationText, certificationText].filter(hasText).join("; ")),
      sourcePaths: [educationText ? `education.${education!.id}` : undefined,
        certificationText ? `certifications.${certification!.id}` : undefined].filter(hasText),
    });
  }
  if (type === "international-relocation") {
    const preference = data.identity.relocationPreference;
    if (preference === "open") details.push({
      text: sentence(data.identity.currentLocation
        ? `I am currently based in ${data.identity.currentLocation} and am open to relocation`
        : "I am open to relocation"),
      sourcePaths: ["identity.relocationPreference", ...(data.identity.currentLocation ? ["identity.currentLocation"] : [])],
    });
    if (preference === "conditional") details.push({
      text: sentence(data.identity.currentLocation
        ? `I am currently based in ${data.identity.currentLocation}; my relocation preference is conditional`
        : "My relocation preference is conditional"),
      sourcePaths: ["identity.relocationPreference", ...(data.identity.currentLocation ? ["identity.currentLocation"] : [])],
    });
  }
  if (type === "technology-startup") {
    const project = data.projects?.find((item) => hasText(item.name));
    if (project && clean(project.name).length <= 100) {
      const firstTechnology = project.technologies.find((item) => hasText(item) && clean(item).length <= 70);
      details.push({ text: sentence(`My profile also includes project experience involving ${project.name}${firstTechnology ? ` and ${firstTechnology}` : ""}`),
        sourcePaths: [`projects.${project.id}`,
          ...(firstTechnology ? [`projects.${project.id}.technologies.${project.technologies.indexOf(firstTechnology)}`] : [])],
      });
    }
  }
  if (!role && !summary && !skills.length && type !== "technology-startup") {
    const project = data.projects?.find((item) => hasText(item.name));
    if (project) details.push(source(`My experience includes the project ${project.name}`, `projects.${project.id}`));
  }
  const secondBody = combined(details);
  if (secondBody) paragraphs.push(secondBody);
  if (paragraphs.length === 1) throw new CoverLetterNotReadyError();
  paragraphs.push({ text: "Thank you for considering my application. I would welcome the opportunity to discuss my background further.", sourcePaths: [] });
  return { type, candidateName: data.identity.fullName, contactLines: contactLines(data),
    salutation: "Dear Hiring Manager,", paragraphs, signOff: "Sincerely," };
}

/** Corporate and relocation use their approved references; Technology & Startup stays on the existing
 * restrained layout until a category-matched reference is approved. */
export function buildCoverLetterModel(mapping: DocumentDataMappingResult, type: CoverLetterType): CoverLetterOutput {
  const content = buildCoverLetterContent(mapping, type);
  const role = recentRole(mapping.data);
  if (type === "technology-startup") {
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
  const skills = (mapping.data.skills ?? []).slice(0, 6).map((item) => item.name);
  const blocks: PdfBlock[] = [
    { kind: "premium-identity", style: "cover-letter", name: content.candidateName,
      headline: role?.jobTitle, contact: content.contactLines },
    { kind: "heading", level: 2,
      text: type === "general-corporate" ? "Re: Professional Opportunity" : "Re: International Opportunity",
      keepWithNext: true },
    { kind: "paragraph", text: content.salutation, keepWithNext: true },
    ...content.paragraphs.map((item): PdfBlock => ({ kind: "paragraph", text: item.text })),
    ...(skills.length ? [{ kind: "competency-grid", items: skills, columns: 2, tone: "plain" } as const] : []),
    { kind: "paragraph", text: content.signOff, keepWithNext: true },
    { kind: "paragraph", text: content.candidateName },
  ];
  return { content, model: { sourceProfileId: mapping.data.sourceProfileId,
    title: `${content.candidateName} - ${COVER_LETTER_LABELS[type]} Cover Letter`,
    sections: [{ id: "letter", blocks }], footer: { text: "Zevantaa Careers", pageNumbers: "current", alignment: "right" } }, theme: {
      margins: { top: 55, right: 55, bottom: 55, left: 55 },
      typography: { ...(type === "general-corporate" ? { headingFontFamily: "Times-Bold" } : {}),
        bodySize: 9.7, smallSize: 8.5, heading1Size: 20, heading2Size: 10.5,
        lineHeight: 1.48, paragraphGap: 9, sectionGap: 1, bulletIndent: 12 },
      accentColor: "#0F172A", secondaryAccentColor: "#0284C7", surfaceColor: "#F8FAFC",
      textColor: "#1E293B", mutedColor: "#475569",
    } };
}
