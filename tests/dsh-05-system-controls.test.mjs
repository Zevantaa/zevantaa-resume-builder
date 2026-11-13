import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { pdfDownloadName, pdfRequestFailureMessage } from "../src/features/document-generation/pdf-request-state.ts";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const pdfControl = source("src/features/document-generation/admin-pdf-request.tsx");
const intake = source("src/features/client-portal/client-intake-service.ts");
const intakeAction = source("src/features/client-portal/save-client-intake-action.ts");
const dashboard = source("src/features/client-portal/client-dashboard-service.ts");

test("PDF request blocks duplicate submission and exposes real transient states", () => {
  assert.match(pdfControl, /if \(requestInFlight\.current\) return/);
  assert.match(pdfControl, /requestInFlight\.current = true/);
  assert.match(pdfControl, /requestInFlight\.current = false/);
  assert.match(pdfControl, /disabled=\{state === "generating"\}/);
  for (const state of ["idle", "generating", "succeeded", "failed"]) assert.match(pdfControl, new RegExp(state));
  assert.match(pdfControl, /response\.blob\(\)/);
  assert.match(pdfControl, /Generate fresh PDF/);
  assert.match(pdfControl, /It was not stored as a client document/);
});

test("PDF request rejects redirects and non-PDF success bodies", () => {
  assert.match(pdfControl, /response\.redirected/);
  assert.match(pdfControl, /application\/pdf/);
  assert.match(pdfControl, /credentials: "same-origin"/);
  assert.match(pdfControl, /cache: "no-store"/);
});

test("PDF request maps error status without reflecting server internals", () => {
  for (const status of [401, 403, 404, 422, 500]) {
    const message = pdfRequestFailureMessage(status, false);
    assert.ok(message.length > 10);
    assert.doesNotMatch(message, /bucket|supabase|storage_object_key|service.role|uuid|stack/i);
  }
  assert.match(pdfRequestFailureMessage(200, true), /session has expired/);
  assert.doesNotMatch(pdfControl, /await response\.text\(\)/);
});

test("PDF filename accepts safe Unicode and rejects path-shaped headers", () => {
  assert.equal(pdfDownloadName("attachment; filename*=UTF-8''Rohan_Global_ATS_Resume.pdf"), "Rohan_Global_ATS_Resume.pdf");
  assert.equal(pdfDownloadName("attachment; filename*=UTF-8''%E0%A4%B0%E0%A5%8B%E0%A4%B9%E0%A4%A8.pdf"), "रोहन.pdf");
  assert.equal(pdfDownloadName('attachment; filename="../../secret.pdf"'), "Zevantaa_Document.pdf");
  assert.equal(pdfDownloadName("attachment; filename*=UTF-8''%not-valid"), "Zevantaa_Document.pdf");
});

test("all production admin generators use the common on-demand request control", () => {
  for (const area of ["global-ats", "domestic-resumes", "gcc-resume", "european-resume", "cover-letters"]) {
    const page = source(`src/app/admin/clients/[userId]/${area}/page.tsx`);
    assert.match(page, /AdminPdfRequest/);
    assert.doesNotMatch(page, /<form[^>]+method="post"/);
  }
  assert.match(source("src/app/admin/clients/[userId]/global-ats/page.tsx"), /privacy-masked\/download/);
});

test("profile and package readiness continue gating generator controls", () => {
  for (const area of ["global-ats", "domestic-resumes", "gcc-resume", "european-resume", "cover-letters"]) {
    const page = source(`src/app/admin/clients/[userId]/${area}/page.tsx`);
    assert.match(page, /mapping\.canGenerate/);
    assert.match(page, /eligible|entitled/);
  }
});

test("admin directory distinguishes zero clients from no matching search results", () => {
  const page = source("src/features/admin-portal/admin-directory-workspace.tsx");
  assert.match(page, /data\.metrics\.clients === 0/);
  assert.match(page, /No clients yet/);
  assert.match(page, /No matching clients/);
  const filters = source("src/features/admin-portal/admin-directory-filters.tsx");
  assert.match(filters, /disabled=\{submitting\}/);
  assert.match(filters, /Loading matching clients/);
});

test("client views distinguish missing source, review, entitlement, and stored PDFs", () => {
  const page = source("src/features/client-portal/client-dashboard-page.tsx");
  assert.match(page, /No source resume is available/);
  assert.match(page, /Review and confirm the extracted details/);
  assert.match(page, /No stored PDFs are available yet/);
  assert.match(source("src/features/client-portal/client-document-workspace.tsx"), /This package does not include/);
  assert.match(dashboard, /source_file_id", profile\.existing_resume_file_id/);
});

test("source and photo replacement validate first, swap own linkage, preserve history", () => {
  assert.match(intake, /Validate all supplied bytes before writing anything/);
  assert.match(intake, /validateIntakeFile\(values\.resume/);
  assert.match(intake, /validateIntakeFile\(values\.photo/);
  assert.match(intake, /upsert: false/);
  assert.match(intake, /replaces_file_id: prior\?\.id/);
  assert.match(intake, /\.eq\("id", linked\.profileId\)/);
  assert.match(intake, /oldResume\.id/);
  assert.match(intake, /oldPhoto\.id/);
  assert.match(intake, /Historical records and objects remain private/);
  assert.match(intake, /isGccPhotoAvailable\(profile\.selected_package_code\)/);
});

test("client action remains role-checked, rejects administrative tampering, and starts durable processing", () => {
  assert.match(intakeAction, /requireApplicationRole\("client"\)/);
  assert.match(intakeAction, /candidateProfileId/);
  assert.match(intakeAction, /selected_package_code/);
  assert.match(intakeAction, /Automatic resume processing has started/);
  assert.match(intakeAction, /processResumeProcessingJobs\(1\)/);
  assert.doesNotMatch(intakeAction, /needs administrator review/);
  assert.match(source("src/features/client-portal/client-intake-form.tsx"), /disabled=\{isPending\}/);
});

test("admin generation and privacy export reload linked profile through server role guard", () => {
  const loader = source("src/features/document-generation/admin-global-ats-service.ts");
  assert.match(loader, /requireApplicationRole\("admin"\)/);
  assert.match(loader, /\.eq\("user_id", userId\)\.eq\("role_code", "client"\)/);
  for (const route of ["global-ats/download", "global-ats/privacy-masked/download", "cover-letters/download", "domestic-resumes/download", "gcc-resume/download", "european-resume/download"]) {
    assert.match(source(`src/app/admin/clients/[userId]/${route}/route.ts`), /loadAdminCandidateProfile\(userId\)/);
  }
});

test("client persisted download is isolated and does not leak document ownership", () => {
  const route = source("src/app/client/documents/[documentId]/download/route.ts");
  const service = source("src/features/client-portal/download-client-document.ts");
  assert.match(route, /Document not available/);
  assert.doesNotMatch(route, /candidate_profile_id|storage_object_key|storage_bucket_name/);
  assert.match(service, /resolveLinkedClientProfile\(\)/);
  assert.match(service, /PRIVATE_DOCUMENT_BUCKET/);
  assert.match(service, /bucket\.public/);
});
