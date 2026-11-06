import "server-only";

import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BRAND_ACCENTS, BRAND_DEFAULTS, BRAND_FONTS,
  type BrandFont, type BrandSettings } from "./brand-settings-config";
export type { BrandSettings } from "./brand-settings-config";

/** Public-safe appearance data only. Defaults keep login usable during configuration errors. */
async function loadBrandSettings(): Promise<BrandSettings> {
  try {
    const { data, error } = await createSupabaseAdminClient().from("app_brand_settings")
      .select("logo_object_key,mark_object_key,ui_font,heading_font,accent_color")
      .eq("id", "default").maybeSingle();
    if (error || !data) return BRAND_DEFAULTS;
    const uiFont = BRAND_FONTS.includes(data.ui_font) ? data.ui_font as BrandFont : BRAND_DEFAULTS.uiFont;
    const headingFont = BRAND_FONTS.includes(data.heading_font) ? data.heading_font as BrandFont : BRAND_DEFAULTS.headingFont;
    return { logoObjectKey: typeof data.logo_object_key === "string" ? data.logo_object_key : null,
      markObjectKey: typeof data.mark_object_key === "string" ? data.mark_object_key : null,
      uiFont, headingFont,
      accentColor: BRAND_ACCENTS.includes(data.accent_color) ? data.accent_color : BRAND_DEFAULTS.accentColor };
  } catch { return BRAND_DEFAULTS; }
}

/** Request-scoped only: metadata and nested layouts can share one safe read. */
export const getBrandSettings = cache(loadBrandSettings);

export function brandLogoPath(settings: BrandSettings): string {
  return settings.logoObjectKey ? "/branding/current/logo" : "/branding/zevantaa-logo-reversed.svg";
}

export function brandMarkPath(settings: BrandSettings): string {
  return settings.markObjectKey ? "/branding/current/mark" : "/branding/favicon.ico";
}
