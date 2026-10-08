import { V1_PACKAGE_DEFINITIONS, type ResumeFormatFamily } from "@/types/package";
import type { PdfOutputKind } from "./pdf/pdf-filename";

/** Frozen output order is shared by server authorization and package-aware UI. */
export const V1_DOCUMENT_OUTPUTS = [
  "global-ats-resume",
  "domestic-resume-1", "domestic-resume-2", "domestic-resume-3",
  "domestic-resume-4", "domestic-resume-5",
  "gcc-resume", "europass-eu-resume",
  "general-corporate-cover-letter", "international-relocation-cover-letter",
  "technology-startup-cover-letter",
] as const satisfies readonly PdfOutputKind[];

const FAMILY_OUTPUTS: Record<ResumeFormatFamily, readonly PdfOutputKind[]> = {
  "global-ats": ["global-ats-resume"],
  domestic: ["domestic-resume-1", "domestic-resume-2", "domestic-resume-3", "domestic-resume-4", "domestic-resume-5"],
  "gcc-middle-east": ["gcc-resume"],
  "europass-european-union": ["europass-eu-resume"],
};
const EXECUTIVE_CODE = "executive-transition-agency-distribution";
const COVER_LETTER_OUTPUTS: readonly PdfOutputKind[] = [
  "general-corporate-cover-letter", "international-relocation-cover-letter", "technology-startup-cover-letter",
];

/** Unknown, malformed, or inactive package values never receive entitlements. */
export function getPackageRouting(packageCode: unknown) {
  if (typeof packageCode !== "string") return null;
  const definition = V1_PACKAGE_DEFINITIONS.find((item) => item.code === packageCode);
  if (!definition?.isActive) return null;
  const allowed = new Set<PdfOutputKind>(definition.resumeFormatFamilies.flatMap((family) => FAMILY_OUTPUTS[family]));
  if (definition.code === EXECUTIVE_CODE) COVER_LETTER_OUTPUTS.forEach((output) => allowed.add(output));
  const allowedOutputs = V1_DOCUMENT_OUTPUTS.filter((output) => allowed.has(output));
  return {
    code: definition.code,
    displayName: definition.displayName,
    targetMarkets: definition.targetMarkets,
    allowedOutputs,
    unavailableOutputs: V1_DOCUMENT_OUTPUTS.filter((output) => !allowed.has(output)),
    atsScoreVisible: allowed.has("global-ats-resume"),
    gccPhotoAvailable: allowed.has("gcc-resume"),
  };
}

export function getAllowedOutputsForPackage(packageCode: unknown): readonly PdfOutputKind[] {
  return getPackageRouting(packageCode)?.allowedOutputs ?? [];
}

export function getUnavailableOutputsForPackage(packageCode: unknown): readonly PdfOutputKind[] {
  return getPackageRouting(packageCode)?.unavailableOutputs ?? V1_DOCUMENT_OUTPUTS;
}

export function packageAllowsOutput(packageCode: unknown, output: unknown): boolean {
  return typeof output === "string" && getAllowedOutputsForPackage(packageCode).some((item) => item === output);
}

export function isAtsScoreVisible(packageCode: unknown): boolean {
  return getPackageRouting(packageCode)?.atsScoreVisible ?? false;
}

export function isGccPhotoAvailable(packageCode: unknown): boolean {
  return getPackageRouting(packageCode)?.gccPhotoAvailable ?? false;
}
