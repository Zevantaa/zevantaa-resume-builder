import { NextResponse } from "next/server";

import { getAuthPortalIntent } from "@/features/authentication";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? "https";

  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    return `${forwardedProtocol}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = getRequestOrigin(request);
  const portal = getAuthPortalIntent(
    requestUrl.searchParams.get("portal") ?? undefined,
  );
  const code = requestUrl.searchParams.get("code");

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(
          new URL(`/reset-password?portal=${portal}`, origin),
        );
      }
    } catch {
      // Redirect to the controlled recovery error state below.
    }
  }

  return NextResponse.redirect(
    new URL(`/reset-password?portal=${portal}&error=invalid-link`, origin),
  );
}
