import type { PdfOutputKind } from "./pdf/pdf-filename";

/** Implementation identity, not a claim that the static master files were reproduced exactly. */
export const V1_TEMPLATE_IMPLEMENTATION_VERSION = "stage2-regional-2026-11-28.1";

export const TEMPLATE_REFERENCE_STATUS: Record<PdfOutputKind, "paired-unverified" | "missing"> = {
  "global-ats-resume": "paired-unverified",
  "domestic-resume-1": "paired-unverified", "domestic-resume-2": "paired-unverified",
  "domestic-resume-3": "paired-unverified", "domestic-resume-4": "paired-unverified",
  "domestic-resume-5": "paired-unverified", "gcc-resume": "paired-unverified",
  "europass-eu-resume": "paired-unverified", "general-corporate-cover-letter": "paired-unverified",
  "international-relocation-cover-letter": "paired-unverified",
  "technology-startup-cover-letter": "missing",
};
