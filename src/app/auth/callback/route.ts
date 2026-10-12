import { NextResponse } from "next/server";

import { getAuthPortalIntent } from "@/features/authentication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createRecoveryProof,
  RECOVERY_COOKIE_NAME,
  RECOVERY_COOKIE_OPTIONS,
} from "@/features/authentication/recovery-proof";

function getRequestOrigin(request: Request) {
  // Proxy forwarding headers are request-controlled at some deployments. They
  // must never choose the destination of a verified recovery redirect.
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
      throw new Error("Invalid application origin configuration.");
    }
    return url.origin;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Application origin is not configured.");
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  let origin: string;
  try {
    origin = getRequestOrigin(request);
  } catch {
    return new Response("Password recovery is temporarily unavailable.", { status: 503 });
  }
  const portal = getAuthPortalIntent(
    requestUrl.searchParams.get("portal") ?? undefined,
  );
  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  if (
    !requestUrl.searchParams.has("error") &&
    (code || (tokenHash && type === "recovery"))
  ) {
    try {
      const supabase = await createServerSupabaseClient();
      let recoveryUserId: string | undefined;
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          code,
          flowId ? { flowId } : undefined,
        );
        // auth-js includes redirectType at runtime, but supabase-js currently
        // omits it from this method's public TypeScript return type.
        const redirectType = (data as typeof data & { redirectType?: string })
          .redirectType;
        if (!error && redirectType === "recovery") {
          recoveryUserId = data.user?.id;
        }
      } else if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (!error) recoveryUserId = data.user?.id;
      }

      if (recoveryUserId) {
        if (process.env.NODE_ENV === "production") {
          await (await import("@/lib/security/rate-limit")).enforceRateLimit("recovery-callback", recoveryUserId, 10);
        }
        const response = NextResponse.redirect(
          new URL(`/reset-password?portal=${portal}`, origin),
        );
        response.cookies.set(
          RECOVERY_COOKIE_NAME,
          createRecoveryProof(recoveryUserId),
          RECOVERY_COOKIE_OPTIONS,
        );
        return response;
      }
    } catch {
      // Redirect to the controlled recovery error state below.
    }
  }

  return NextResponse.redirect(
    new URL(`/reset-password?portal=${portal}&error=invalid-link`, origin),
  );
}
