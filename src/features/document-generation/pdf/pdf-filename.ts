/** Frozen V1 output labels; no template or output entitlement is implemented here. */
export type PdfOutputKind =
  | "global-ats-resume"
  | "domestic-resume-1" | "domestic-resume-2" | "domestic-resume-3"
  | "domestic-resume-4" | "domestic-resume-5"
  | "gcc-resume" | "europass-eu-resume"
  | "general-corporate-cover-letter"
  | "international-relocation-cover-letter"
  | "technology-startup-cover-letter";

const OUTPUT_LABELS: Record<PdfOutputKind, string> = {
  "global-ats-resume": "Global_ATS_Resume",
  "domestic-resume-1": "Domestic_Resume_1",
  "domestic-resume-2": "Domestic_Resume_2",
  "domestic-resume-3": "Domestic_Resume_3",
  "domestic-resume-4": "Domestic_Resume_4",
  "domestic-resume-5": "Domestic_Resume_5",
  "gcc-resume": "GCC_Resume",
  "europass-eu-resume": "Europass_EU_Resume",
  "general-corporate-cover-letter": "General_Corporate_Cover_Letter",
  "international-relocation-cover-letter": "International_Relocation_Cover_Letter",
  "technology-startup-cover-letter": "Technology_Startup_Cover_Letter",
};

function safeStem(value: string, asciiOnly: boolean): string {
  const normalized = value.normalize(asciiOnly ? "NFKD" : "NFKC");
  const withoutLatinAccents = asciiOnly ? normalized.replace(/\p{M}/gu, "") : normalized;
  const permitted = asciiOnly ? /[^A-Za-z0-9]+/g : /[^\p{L}\p{N}\p{M}]+/gu;
  return Array.from(withoutLatinAccents.replace(permitted, "_").replace(/^_+|_+$/g, ""))
    .slice(0, 80).join("").replace(/[_\p{M}]+$/gu, "");
}

/** Safe, deterministic download name; Unicode by default, ASCII fallback on request. */
export function buildPdfFilename(input: {
  candidateName?: string | null;
  output: PdfOutputKind;
  privacyMasked?: boolean;
  asciiOnly?: boolean;
}): string {
  const label = OUTPUT_LABELS[input.output];
  if (!label) throw new RangeError("Unknown PDF output kind.");
  if (input.privacyMasked && input.output.endsWith("cover-letter")) {
    throw new RangeError("Privacy-masked naming is only supported for resume outputs.");
  }
  const name = safeStem(input.candidateName ?? "", input.asciiOnly === true) || "Candidate";
  return `${name}_${label}${input.privacyMasked ? "_Masked" : ""}.pdf`;
}

/** Defend the HTTP boundary even when a future caller supplies a filename directly. */
export function sanitizePdfDownloadFilename(value: string): string {
  const stem = safeStem(value.replace(/\.pdf$/iu, ""), false) || "Document";
  return `${stem}.pdf`;
}
