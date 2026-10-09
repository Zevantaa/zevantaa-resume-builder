import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const RECOVERY_COOKIE_NAME = "zevantaa-recovery-proof";
const RECOVERY_PROOF_LIFETIME_SECONDS = 15 * 60;

function signingKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key || key.includes("your-supabase-")) {
    throw new Error("Server-side recovery signing is not configured.");
  }

  return key;
}

function signature(payload: string) {
  return createHmac("sha256", signingKey())
    .update(`zevantaa-password-recovery:v1:${payload}`)
    .digest("hex");
}

export function createRecoveryProof(userId: string, now = Date.now()) {
  const payload = `${userId}.${Math.floor(now / 1000)}`;
  return `${payload}.${signature(payload)}`;
}

export function isValidRecoveryProof(
  proof: string | undefined,
  userId: string,
  now = Date.now(),
) {
  if (!proof) return false;
  const match = /^([0-9a-f-]{36})\.(\d{10})\.([0-9a-f]{64})$/.exec(proof);
  if (!match || match[1] !== userId) return false;

  const issuedAt = Number(match[2]);
  const currentTime = Math.floor(now / 1000);
  if (issuedAt > currentTime || currentTime - issuedAt > RECOVERY_PROOF_LIFETIME_SECONDS) {
    return false;
  }

  const expected = Buffer.from(signature(`${match[1]}.${match[2]}`), "hex");
  const received = Buffer.from(match[3], "hex");
  return timingSafeEqual(expected, received);
}

export const RECOVERY_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: RECOVERY_PROOF_LIFETIME_SECONDS,
  path: "/reset-password",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const;
