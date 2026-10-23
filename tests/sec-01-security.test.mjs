import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isSafeExternalUrl } from "../src/lib/security/external-url.ts";
import nextConfig from "../next.config.ts";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("external URL validator rejects active, internal, credential and malformed URLs", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>x</script>",
    "http://localhost:3000/a", "http://127.0.0.1/a", "http://10.0.0.1/a",
    "https://user:secret@example.com/a", "https://intranet.internal/a",
    "https://example.com:8080/a", "https://example.com/with space", "//example.com/a", "not a url"]) {
    assert.equal(isSafeExternalUrl(url), false, url);
  }
  assert.equal(isSafeExternalUrl("https://example.org/credential/fictional"), true);
});

test("prepared migration revokes direct table/RPC access and covers review FK", () => {
  const sql = source("supabase/migrations/20261010212007_sec_01_least_privilege_and_audit.sql");
  assert.match(sql, /revoke execute on function public\.rls_auto_enable\(\) from public, anon, authenticated, service_role/i);
  assert.match(sql, /revoke all on all tables in schema public from anon, authenticated/i);
  assert.match(sql, /grant select on public\.user_roles to authenticated/i);
  assert.match(sql, /on public\.profile_resume_reviews \(confirmed_by_user_id\)/i);
  assert.match(sql, /revoke all on function public\.consume_application_rate_limit[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /alter table public\.security_audit_events enable row level security/i);
});

test("role, ownership and hostile-form safeguards remain server-side", () => {
  const auth = source("src/features/authentication/authorization.ts");
  const career = source("src/features/client-portal/career-profile-validation.ts");
  const intake = source("src/features/client-portal/save-client-intake-action.ts");
  const account = source("src/features/admin-portal/client-account-service.ts");
  assert.match(auth, /supabase\.auth\.getClaims\(\)/);
  assert.match(auth, /\.from\("user_roles"\)/);
  assert.match(auth, /accountStatus !== "active"/);
  assert.match(career, /allowedKeys\(value, \["professionalSummary"/);
  assert.match(intake, /"candidateProfileId"/);
  assert.match(intake, /"packageCode"/);
  assert.match(account, /requireApplicationRole\("admin"\)/);
});

test("server-only service key and private bucket boundary remain explicit", () => {
  const admin = source("src/lib/supabase/admin.ts");
  const upload = source("src/features/client-portal/client-intake-service.ts");
  assert.match(admin, /import "server-only"/);
  assert.doesNotMatch(admin, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
  assert.match(upload, /candidate-intake-private/);
  assert.match(upload, /randomUUID\(\)/);
  assert.doesNotMatch(upload, /getPublicUrl/);
  assert.doesNotMatch(source("src/features/client-portal/intake-file-validation.ts"), /from "sharp"/);
  assert.match(source("src/features/client-portal/decode-intake-photo.ts"), /import "server-only"/);
});

test("security headers cover framing, MIME sniffing, referrer, permissions and CSP", async () => {
  const entries = await nextConfig.headers();
  const headers = Object.fromEntries(entries[0].headers.map(({ key, value }) => [key, value]));
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.ok(headers["Referrer-Policy"]);
  assert.ok(headers["Permissions-Policy"]);
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
});

test("production header policy includes HSTS and excludes development websocket/eval allowances", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const { default: productionConfig } = await import("../next.config.ts?rel-01-production");
    const entries = await productionConfig.headers();
    const headers = Object.fromEntries(entries[0].headers.map(({ key, value }) => [key, value]));
    assert.match(headers["Strict-Transport-Security"], /max-age=31536000/);
    assert.match(headers["Content-Security-Policy"], /upgrade-insecure-requests/);
    assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
    assert.doesNotMatch(headers["Content-Security-Policy"], /unsafe-eval|ws:\/\/localhost/);
    assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
    assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("skill library and brand mutation stay behind server-only and admin boundaries", () => {
  const skills = source("src/features/client-portal/skill-library-service.ts");
  const brand = source("src/features/branding/save-brand-settings-action.ts");
  assert.match(skills, /import "server-only"/);
  assert.match(skills, /resolveLinkedClientProfile\(\)/);
  assert.match(brand, /requireApplicationRole\("admin"\)/);
  assert.match(brand, /validatedBrandImage/);
  assert.doesNotMatch(brand, /getPublicUrl/);
});
