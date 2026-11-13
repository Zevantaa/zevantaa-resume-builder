import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("temporary passwords are generated server-side, shown once and force replacement", () => {
  const service = read("src/features/admin-portal/client-account-service.ts");
  const form = read("src/features/admin-portal/client-account-form.tsx");
  const authorization = read("src/features/authentication/authorization.ts");
  const layout = read("src/app/client/layout.tsx");
  assert.match(service, /randomBytes\(24\)/u);
  assert.match(service, /auth\.admin\.createUser/u);
  assert.match(service, /must_change_password: true/u);
  assert.match(form, /displayed once/u);
  assert.match(authorization, /must_change_password/u);
  assert.match(layout, /redirect\("\/change-password"\)/u);
  assert.doesNotMatch(service, /\.from\([^)]*password/iu, "no database password store is allowed");
});

test("all successful extractions require client confirmation and no admin approval control", () => {
  const readiness = read("src/features/document-generation/resume-processing-readiness.ts");
  const worker = read("src/features/document-generation/resume-processing-service.ts");
  const adminPage = read("src/app/admin/clients/[userId]/resume-review/page.tsx");
  assert.match(readiness, /code: "client-confirmation-required"/u);
  assert.match(readiness, /outcome: "needs-input"/u);
  assert.doesNotMatch(worker, /accept_automated_resume_processing_job/u);
  assert.doesNotMatch(adminPage, /AdminResumeReviewForm/u);
  assert.match(adminPage, /Only the linked client can confirm/u);
});

test("replacement conflicts and every generated resume ATS variant are visible", () => {
  const review = read("src/features/client-portal/client-resume-input-service.ts");
  const reviewForm = read("src/features/client-portal/client-resume-input-forms.tsx");
  const atsService = read("src/features/document-generation/document-ats-comparison-service.ts");
  const atsCard = read("src/features/document-generation/document-ats-comparison-card.tsx");
  assert.match(review, /"already-saved" \| "conflict"/u);
  assert.match(reviewForm, /previously confirmed/u);
  assert.match(atsService, /!row\.output_kind\.endsWith\("cover-letter"\)/u);
  assert.match(atsCard, /Compare generated resume/u);
  assert.match(atsCard, /not a third-party ATS guarantee/u);
});

test("current-source confirmation gates idempotent package enqueueing", () => {
  const sql = read("supabase/migrations/20261113124500_client_confirmation_release_fixes.sql");
  assert.match(sql, /r\.source_file_id = v_profile\.existing_resume_file_id/u);
  assert.match(sql, /input_confirmed_by_user_id is not null/u);
  assert.match(sql, /confirm_client_resume_processing_input_v2/u);
  assert.doesNotMatch(sql, /primary_email\s*=/u);
  assert.match(sql, /on conflict \(candidate_profile_id, output_kind, source_career_revision\)/u);
  assert.doesNotMatch(sql, /delete from|truncate|drop table/iu);
});
