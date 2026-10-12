import "server-only";

import { createHmac } from "node:crypto";

import { createSupabaseAdminClient } from "../supabase/admin";

export type RateLimitScope =
  | "recovery-callback" | "password-update" | "client-provision"
  | "client-edit" | "career-save" | "resume-upload" | "photo-upload"
  | "brand-upload" | "pdf-generation" | "resume-review";

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please wait and try again.");
    this.name = "RateLimitError";
  }
}

/** Atomic, cross-instance counter in Postgres. A pending migration is required in production. */
export async function enforceRateLimit(scope: RateLimitScope, subject: string,
  limit: number, windowSeconds = 3600): Promise<void> {
  const key = process.env.SECURITY_RATE_LIMIT_KEY?.trim();
  if (!key || key.length < 32 || key.startsWith("replace-with-") || key.startsWith("your-")) {
    if (process.env.NODE_ENV === "production") throw new RateLimitError();
    return;
  }
  if (!subject || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(windowSeconds) || windowSeconds < 60 || windowSeconds > 86400) {
    throw new RateLimitError();
  }
  const hash = createHmac("sha256", key).update(`${scope}:${subject}`).digest("hex");
  const { data, error } = await createSupabaseAdminClient().rpc("consume_application_rate_limit", {
    p_scope: scope, p_subject_hash: hash, p_window_seconds: windowSeconds, p_limit: limit,
  });
  if (error || data !== true) throw new RateLimitError();
}
