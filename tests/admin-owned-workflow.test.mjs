import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("client profile renders core fields as read-only data and file inputs only", () => {
  const profile = read("src/features/client-portal/client-intake-form.tsx");
  assert.match(profile, /<dl className="dashboard-detail-list/);
  for (const label of ["Full name", "Primary email / login", "Mobile number", "WhatsApp number", "LinkedIn profile", "Current location", "Relocation preference", "Assigned package"]) {
    assert.ok(profile.includes(label), label);
  }
  assert.doesNotMatch(profile, /<(TextInput|SelectField|textarea)\b/);
  assert.match(profile, /name="resume"/);
  assert.match(profile, /name="photo"/);
});

test("upload-only save path does not write administratively managed columns", () => {
  const service = read("src/features/client-portal/client-intake-service.ts");
  const update = service.match(/\.from\("candidate_profiles"\)\s*\.update\(\{([\s\S]*?)\}\)/);
  assert.ok(update);
  assert.match(update[1], /existing_resume_file_id/);
  assert.match(update[1], /gcc_photo_file_id/);
  for (const field of ["full_name", "primary_email", "mobile_number", "whatsapp_number", "linkedin_url", "current_location", "relocation_preference", "selected_package_code", "target_markets"]) {
    assert.ok(!update[1].includes(field), field);
  }
});

test("onboarding migration only relaxes first-resume nullability without new browser access", () => {
  const migration = read("supabase/migrations/20260929000100_admin_owned_profile_onboarding.sql");
  assert.match(migration, /alter column existing_resume_file_id drop not null/i);
  assert.doesNotMatch(migration, /create\s+table|create\s+policy|grant\s+/i);
});

test("client-facing source contains no service-role or secret-key configuration", () => {
  for (const path of [
    "src/features/client-portal/client-intake-form.tsx",
    "src/features/admin-portal/client-account-form.tsx",
    "src/features/admin-portal/edit-client-account-form.tsx",
  ]) {
    assert.doesNotMatch(read(path), /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|service_role/);
  }
});
