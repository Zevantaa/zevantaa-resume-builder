import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateEnvironment } from "../scripts/validate-environment.mjs";

const valid = {
  NEXT_PUBLIC_APP_URL: "https://resume.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  SUPABASE_SECRET_KEY: "fixture-secret-for-validator-only",
  SECURITY_RATE_LIMIT_KEY: "fixture-long-rate-key-which-is-not-a-credential",
};

test("deployment environment is explicit and local development stays usable", () => {
  assert.deepEqual(validateEnvironment("local", {}), []);
  assert.match(validateEnvironment("unexpected", {})[0], /local, preview, or production/);
});

test("preview and production require separated, non-placeholder configuration", () => {
  assert.deepEqual(validateEnvironment("preview", valid), []);
  assert.deepEqual(validateEnvironment("production", valid), []);
  assert.ok(validateEnvironment("production", {}).length >= 5);
  assert.ok(validateEnvironment("production", { ...valid, SUPABASE_SECRET_KEY: "your-secret-key" }).some((item) => item.includes("SUPABASE_SECRET_KEY")));
});

test("production rejects localhost, insecure origins and secret keys in public variable", () => {
  assert.ok(validateEnvironment("production", { ...valid, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).length > 0);
  assert.ok(validateEnvironment("production", { ...valid, NEXT_PUBLIC_SUPABASE_URL: "http://project.supabase.co" }).length > 0);
  assert.ok(validateEnvironment("production", { ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "service_role_fixture" }).some((item) => item.includes("browser")));
});

test("release workflow requires core checks without embedding privileged configuration", () => {
  const workflow = readFileSync(".github/workflows/quality-security.yml", "utf8");
  for (const command of ["npm ci", "npm test", "npm run lint", "npm run build", "npm audit --omit=dev", "git diff --check", "security:secrets", "npm sbom --sbom-format cyclonedx --omit=dev"]) {
    assert.ok(workflow.includes(command), command);
  }
  assert.ok(!workflow.includes("SUPABASE_SECRET_KEY"));
});
