import { NextResponse } from "next/server";

import { getAuthPortalIntent } from "@/features/authentication";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createRecoveryProof,
  RECOVERY_COOKIE_NAME,
  RECOVERY_COOKIE_OPTIONS,
} from "@/features/authentication/recovery-proof";

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
