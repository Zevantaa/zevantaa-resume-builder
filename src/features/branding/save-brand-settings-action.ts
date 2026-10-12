"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/audit-events";
import { BRAND_ACCENTS, BRAND_BUCKET, BRAND_FONTS, type BrandFont } from "./brand-settings-config";
import { getBrandSettings } from "./brand-settings-service";

export type BrandActionState = { status: "idle" | "success" | "error"; message: string };

async function validatedBrandImage(value: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > 2 * 1024 * 1024 || !["image/png", "image/webp"].includes(value.type))
    throw new Error("Use a PNG or WebP image under 2 MB.");
  const bytes = Buffer.from(await value.arrayBuffer());
  const image = sharp(bytes, { failOn: "error", limitInputPixels: 16_000_000 });
  const metadata = await image.metadata();
  if (!["png", "webp"].includes(metadata.format ?? "") || !metadata.width || !metadata.height ||
    metadata.width > 4000 || metadata.height > 4000) throw new Error("The image format or dimensions are not supported.");
  return new Uint8Array(await image.png({ compressionLevel: 9 }).toBuffer());
}

export async function saveBrandSettingsAction(_previous: BrandActionState, formData: FormData): Promise<BrandActionState> {
  const admin = await requireApplicationRole("admin");
  if ([...formData.keys()].some((key) => !["uiFont", "headingFont", "accentColor", "logo", "mark"].includes(key)))
    return { status: "error", message: "Unexpected appearance field. Refresh and retry." };
  const uiFont = formData.get("uiFont");
  const headingFont = formData.get("headingFont");
  const accentColor = formData.get("accentColor");
  if (typeof uiFont !== "string" || !BRAND_FONTS.includes(uiFont as BrandFont) || uiFont === "georgia" ||
    typeof headingFont !== "string" || !BRAND_FONTS.includes(headingFont as BrandFont) ||
    typeof accentColor !== "string" || !BRAND_ACCENTS.includes(accentColor as typeof BRAND_ACCENTS[number]))
    return { status: "error", message: "Choose an approved font and accent color." };
  try {
    await enforceRateLimit("brand-upload", admin.userId!, 20);
    const [logo, mark, previous] = await Promise.all([
      validatedBrandImage(formData.get("logo")), validatedBrandImage(formData.get("mark")), getBrandSettings(),
    ]);
    const db = createSupabaseAdminClient();
    let logoObjectKey = previous.logoObjectKey;
    let markObjectKey = previous.markObjectKey;
    if (logo) {
      logoObjectKey = `approved/logo-${randomUUID()}.png`;
      const { error } = await db.storage.from(BRAND_BUCKET).upload(logoObjectKey, logo,
        { contentType: "image/png", upsert: false });
      if (error) throw new Error("Logo upload failed.");
    }
    if (mark) {
      markObjectKey = `approved/mark-${randomUUID()}.png`;
      const { error } = await db.storage.from(BRAND_BUCKET).upload(markObjectKey, mark,
        { contentType: "image/png", upsert: false });
      if (error) throw new Error("Mark upload failed.");
    }
    const { error } = await db.from("app_brand_settings").update({
      logo_object_key: logoObjectKey, mark_object_key: markObjectKey,
      ui_font: uiFont, heading_font: headingFont, accent_color: accentColor,
      updated_at: new Date().toISOString(), updated_by_user_id: admin.userId,
    }).eq("id", "default");
    if (error) throw new Error("Appearance could not be saved.");
    await recordSecurityEvent({ eventType: "brand.settings.changed", actorUserId: admin.userId!, outcome: "success" });
    revalidatePath("/", "layout");
    return { status: "success", message: "Appearance saved. Refresh other open tabs to see the new assets." };
  } catch (error) {
    return { status: "error", message: error instanceof Error && error.message.startsWith("Use a PNG") ? error.message
      : "Appearance could not be saved. Check the files and try again." };
  }
}
