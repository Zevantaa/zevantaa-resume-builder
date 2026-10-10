import "server-only";

import { createHash } from "node:crypto";

import type { PdfDocumentModel } from "./pdf/pdf-model";
import { buildGlobalAtsResumeModel } from "./global-ats-resume";
import type { DocumentDataMappingResult } from "./profile-mapper";

/** Non-reversible, 80-bit digest of the random candidate-profile UUID, not the Auth ID. */
export function createCandidateReferenceId(profileId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw new RangeError("A valid candidate profile ID is required.");
  }
  const digest = createHash("sha256")
    .update(`zevantaa-candidate-reference:v1:${profileId.toLowerCase()}`)
    .digest("hex");
  return `ZV-CAN-${digest.slice(0, 20).toUpperCase()}`;
}

export class PrivacyMaskReviewRequiredError extends Error {
  constructor() {
    super("Direct candidate contact information appears in career content. Review the profile before employer export.");
    this.name = "PrivacyMaskReviewRequiredError";
  }
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.entries(value)
    .filter(([key]) => key !== "id" && key !== "sourceProfileId")
    .flatMap(([, child]) => strings(child));
  return [];
}

/** Fail closed if a supplied free-text field repeats a known direct contact route. */
function containsKnownContact(model: PdfDocumentModel, mapping: DocumentDataMappingResult) {
  const { primaryEmail, mobileNumber, whatsappNumber, linkedinUrl } = mapping.data.identity;
  const email = primaryEmail?.trim().toLowerCase();
  const linkedin = linkedinUrl?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const phones = [mobileNumber, whatsappNumber].filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\D/g, ""))
    .flatMap((value) => value.length >= 10 ? [value, value.slice(-10)] : [value])
    .filter((value) => value.length >= 7);

  return strings(model.sections).some((text) => {
    const lower = text.toLowerCase();
    const digits = text.replace(/\D/g, "");
    return Boolean((email && lower.includes(email)) ||
      (linkedin && lower.replace(/^https?:\/\//, "").replace(/\/$/, "").includes(linkedin)) ||
      phones.some((phone) => digits.includes(phone)) ||
      /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(text) ||
      /\b(?:www\.)?linkedin\.com\//i.test(text) ||
      /\b(?:tel|phone|mobile|whatsapp)\s*:\s*\+?[\d\s().-]{7,}/i.test(text) ||
      /\+\d[\d\s().-]{7,}\d/.test(text));
  });
}

/** Pure masking: clone the document projection; never edit the canonical source. */
export function buildPrivacyMaskedEmployerResume(mapping: DocumentDataMappingResult): {
  model: PdfDocumentModel;
  referenceId: string;
} {
  const referenceId = createCandidateReferenceId(mapping.data.sourceProfileId);
  const { fullName, currentLocation, relocationPreference } = mapping.data.identity;
  const maskedMapping: DocumentDataMappingResult = {
    ...mapping,
    data: { ...mapping.data, identity: {
      fullName, relocationPreference,
      ...(currentLocation ? { currentLocation } : {}),
    } },
  };
  const model = buildGlobalAtsResumeModel(maskedMapping, { referenceId });
  if (containsKnownContact(model, mapping)) throw new PrivacyMaskReviewRequiredError();
  return { model, referenceId };
}
