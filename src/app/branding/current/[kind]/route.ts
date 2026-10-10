import { NextResponse } from "next/server";

import { BRAND_BUCKET } from "@/features/branding/brand-settings-config";
import { getBrandSettings } from "@/features/branding/brand-settings-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "logo" && kind !== "mark") return new Response("Not found", { status: 404 });
  const settings = await getBrandSettings();
  const key = kind === "logo" ? settings.logoObjectKey : settings.markObjectKey;
  if (!key || !new RegExp(`^approved/${kind}-[0-9a-f-]{36}\\.png$`, "i").test(key)) {
    return NextResponse.redirect(new URL(kind === "logo" ? "/branding/zevantaa-logo-reversed.svg" : "/branding/favicon.ico", _request.url));
  }
  try {
    const { data, error } = await createSupabaseAdminClient().storage.from(BRAND_BUCKET).download(key);
    if (error || !data) return new Response("Not found", { status: 404 });
    return new Response(await data.arrayBuffer(), { headers: { "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
