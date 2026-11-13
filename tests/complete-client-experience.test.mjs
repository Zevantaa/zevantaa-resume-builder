import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/u.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { assessExtractedResumeDocument, DOCUMENT_ATS_ALGORITHM_VERSION } = await import("../src/features/document-generation/document-ats-score.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("document ATS method uses actual extracted text and remains deterministic", () => {
  const text = `Rohan Example\nEmail: rohan@example.test | Mobile: +91 90000 00000 | LinkedIn: linkedin.com/in/rohan\n\nProfessional Summary\nOperations leader with verified experience improving delivery and reporting across regional teams.\n\nProfessional Experience\nOperations Manager | Example Company | January 2021 - Present\n• Led service delivery and improved reporting.\n• Managed cross-functional teams.\n\nEducation\nMaster of Business Administration | Example University | 2020\n\nCore Skills\nOperations, Reporting, Leadership, Planning, Analysis, Stakeholder Management, Excel, Forecasting\n\nCertifications\nProject Management Certificate\n\nProjects\nReporting modernization\n\nLanguages\nEnglish`;
  const first = assessExtractedResumeDocument({ text, pageCount: 2, warnings: [] });
  const second = assessExtractedResumeDocument({ text, pageCount: 2, warnings: [] });
  assert.deepEqual(first, second);
  assert.equal(first.status, "ready");
  assert.ok(first.score >= 0 && first.score <= 100);
  assert.equal(first.breakdown.length, 8);
  assert.equal(first.breakdown.reduce((total, item) => total + item.maximum, 0), 100);
  assert.equal(first.breakdown.reduce((total, item) => total + item.score, 0), first.score);
  assert.equal(DOCUMENT_ATS_ALGORITHM_VERSION, "zevantaa-document-ats-v1");
});

test("insufficient, nonstandard and long extracted documents do not receive fabricated results", () => {
  assert.deepEqual(assessExtractedResumeDocument({ text: "image only", pageCount: 1 }), {
    status: "unavailable", findings: ["The document did not contain enough searchable text for a credible assessment."],
  });
  const nonstandard = assessExtractedResumeDocument({
    text: `${"Career chronology without headings or delimiters. ".repeat(80)} 2010 2014 2018`,
    pageCount: 8, warnings: [{ code: "low-text-page" }],
  });
  assert.equal(nonstandard.status, "ready");
  assert.ok(nonstandard.score < 90);
  assert.match(nonstandard.breakdown.find((item) => item.dimension === "formatting").reason, /low-text page warning/i);
});

test("migration is additive, private, document-linked and lease-safe", () => {
  const sql = read("supabase/migrations/20261113052443_complete_client_experience_admin_ats.sql");
  assert.match(sql, /create table public\.document_ats_assessments/iu);
  assert.match(sql, /foreign key \(candidate_profile_id, source_file_id\)[\s\S]*public\.file_records/iu);
  assert.match(sql, /foreign key \(candidate_profile_id, document_record_id\)[\s\S]*public\.document_records/iu);
  assert.match(sql, /algorithm_version = 'zevantaa-document-ats-v1'/iu);
  assert.match(sql, /document_ats_assessments_resume_output_check/iu);
  assert.doesNotMatch(sql.match(/document_ats_assessments_resume_output_check[\s\S]*?\)\n  \),/iu)?.[0] ?? "", /cover-letter/iu);
  assert.match(sql, /for update of q skip locked/iu);
  assert.match(sql, /alter table public\.document_ats_assessments enable row level security/iu);
  assert.match(sql, /alter table public\.candidate_profiles enable row level security/iu);
  assert.match(sql, /alter table public\.document_records enable row level security/iu);
  assert.match(sql, /alter table public\.file_records enable row level security/iu);
  assert.match(sql, /revoke all on public\.document_ats_assessments from public, anon, authenticated/iu);
  assert.match(sql, /create function public\.archive_client_account/iu);
  assert.match(sql, /create function public\.restore_client_account/iu);
  assert.match(sql, /client_recovery_until/iu);
  assert.match(sql, /last_error_code = 'client-archived'/iu);
  assert.doesNotMatch(sql, /drop table|truncate/iu);
});

test("permanent deletion is server-controlled, scoped and disabled until verified", () => {
  const service = read("src/features/admin-portal/client-lifecycle-service.ts");
  assert.match(service, /ZEVANTAA_PERMANENT_DELETION_ENABLED !== "true"/u);
  assert.match(service, /requireApplicationRole\("admin"\)/u);
  assert.match(service, /key\.startsWith\(`\$\{profileId\}\//u);
  assert.match(service, /candidate-intake-private/u);
  assert.match(service, /candidate-documents-private/u);
  assert.match(service, /deleteUser\(role\.user_id, true\)/u);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE_ROLE_KEY/u);
});

test("client access handoff never persists or retrieves plaintext passwords", () => {
  const access = read("src/features/admin-portal/client-access-details.tsx");
  const action = read("src/features/admin-portal/generate-client-access-link-action.ts");
  const service = read("src/features/admin-portal/client-account-service.ts");
  assert.match(access, /Copy Complete Welcome Message/u);
  assert.match(access, /Copy WhatsApp Welcome Message/u);
  assert.match(access, /Generate Password Setup Link/u);
  assert.match(service, /auth\.admin\.generateLink/u);
  assert.match(service, /type: "recovery"/u);
  assert.doesNotMatch(`${access}\n${action}\n${service}`, /plaintextPassword|storedPassword|existingPassword/u);
  assert.doesNotMatch(action, /console\.|logger/u);
});

test("comparison is shown in every required client and admin workspace", () => {
  for (const path of [
    "src/features/client-portal/client-dashboard-page.tsx",
    "src/app/client/ats/page.tsx",
    "src/features/client-portal/client-document-workspace.tsx",
    "src/features/admin-portal/edit-client-account-page.tsx",
  ]) assert.match(read(path), /DocumentAtsComparisonCard/u, path);
  const card = read("src/features/document-generation/document-ats-comparison-card.tsx");
  assert.match(card, /Indicative ATS Assessment/u);
  assert.match(card, /not a third-party ATS guarantee/u);
  assert.doesNotMatch(card, /guaranteed|minimum 90/iu);
});
