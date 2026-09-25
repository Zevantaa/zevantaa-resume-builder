import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "./config";

export class SupabaseAdminConfigurationError extends Error {
  constructor() {
    super("Supabase server-side administration is not configured.");
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secretKey || secretKey.includes("your-supabase-")) {
    throw new SupabaseAdminConfigurationError();
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
