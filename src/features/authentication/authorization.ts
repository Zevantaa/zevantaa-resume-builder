import "server-only";

import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  ApplicationRole,
  AuthContext,
  AuthPortalIntent,
} from "./types";

function isApplicationRole(value: unknown): value is ApplicationRole {
  return value === "admin" || value === "client";
}

export async function getAuthContext(): Promise<AuthContext> {
  if (!isSupabaseConfigured()) {
    return { role: null, userId: null };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || typeof userId !== "string") {
      return { role: null, userId: null };
    }

    const { data: roleRecord, error: roleError } = await supabase
      .from("user_roles")
      .select("role_code")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError || !isApplicationRole(roleRecord?.role_code)) {
      return { role: null, userId };
    }

    return { role: roleRecord.role_code, userId };
  } catch {
    return { role: null, userId: null };
  }
}

export async function requireApplicationRole(
  expectedRole: ApplicationRole,
) {
  const authContext = await getAuthContext();

  if (!authContext.userId) {
    redirect(`/login?portal=${expectedRole}`);
  }

  if (authContext.role !== expectedRole) {
    redirect(`/access-denied?portal=${expectedRole}`);
  }

  return authContext;
}

export function getRequestedPortal(
  value: string | string[] | undefined,
): AuthPortalIntent {
  return value === "admin" ? "admin" : "client";
}
