export interface PdfMargins { top: number; right: number; bottom: number; left: number }
export interface PdfTypography {
  fontFamily: string;
  bodySize: number;
  smallSize: number;
  heading1Size: number;
  heading2Size: number;
  lineHeight: number;
  paragraphGap: number;
  sectionGap: number;
  bulletIndent: number;
}
export interface PdfTheme {
  margins: PdfMargins;
  typography: PdfTypography;
  textColor: string;
  mutedColor: string;
}
export type PdfThemeOverrides = {
  margins?: Partial<PdfMargins>;
  typography?: Partial<PdfTypography>;
  textColor?: string;
  mutedColor?: string;
};

export const DEFAULT_PDF_THEME: Readonly<PdfTheme> = {
  margins: { top: 42, right: 44, bottom: 42, left: 44 },
  typography: {
    fontFamily: "Zevantaa PDF Latin",
    bodySize: 10,
    smallSize: 8.5,
    heading1Size: 17,
    heading2Size: 12,
    lineHeight: 1.35,
    paragraphGap: 6,
    sectionGap: 13,
    bulletIndent: 13,
  },
  textColor: "#0B132B",
  mutedColor: "#4B5563",
};

/** A4 in points. Bound settings so a caller cannot create a clipped page. */
export function resolvePdfTheme(overrides: PdfThemeOverrides = {}): PdfTheme {
  const margins = { ...DEFAULT_PDF_THEME.margins, ...overrides.margins };
  const typography = { ...DEFAULT_PDF_THEME.typography, ...overrides.typography };
  for (const value of Object.values(margins)) {
    if (!Number.isFinite(value) || value < 20 || value > 100) throw new RangeError("PDF margins must be between 20 and 100 pt.");
  }
  for (const [key, value] of Object.entries(typography)) {
    if (key === "fontFamily") continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 60) throw new RangeError(`Invalid PDF typography token: ${key}.`);
  }
  if (typography.lineHeight < 1 || typography.lineHeight > 2) throw new RangeError("PDF line height must be between 1 and 2.");
  return { margins, typography, textColor: overrides.textColor ?? DEFAULT_PDF_THEME.textColor,
    mutedColor: overrides.mutedColor ?? DEFAULT_PDF_THEME.mutedColor };
}
