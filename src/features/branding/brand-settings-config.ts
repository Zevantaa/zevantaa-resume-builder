export type BrandFont = "inter" | "arial" | "segoe-ui" | "verdana" | "georgia";
export type BrandSettings = { logoObjectKey: string | null; markObjectKey: string | null;
  uiFont: BrandFont; headingFont: BrandFont; accentColor: string };

export const BRAND_DEFAULTS: BrandSettings = {
  logoObjectKey: null, markObjectKey: null, uiFont: "inter", headingFont: "inter", accentColor: "#0fa36f",
};
export const BRAND_FONTS: readonly BrandFont[] = ["inter", "arial", "segoe-ui", "verdana", "georgia"];
export const BRAND_ACCENTS = ["#0fa36f", "#3568f0", "#d6a32d", "#6d4bd1"] as const;
export const BRAND_BUCKET = "zevantaa-brand-assets";
export const BRAND_FONT_FAMILY: Record<BrandFont, string> = {
  inter: "var(--font-brand-inter), Inter, ui-sans-serif, system-ui, sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  "segoe-ui": "'Segoe UI', Arial, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
  georgia: "Georgia, serif",
};
