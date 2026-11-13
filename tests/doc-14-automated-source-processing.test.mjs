import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mockModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      "server-only": "export {}",
      "@/lib/supabase/admin": "export function createSupabaseAdminClient(){return globalThis.__sourceProcessingQa.db}",
    };
    if (specifier in mocks) return { url: mockModule(mocks[specifier]), shortCircuit: true };
    if (specifier === "./current-client-resume-service" && context.parentURL?.endsWith("resume-processing-service.ts")) {
      return { url: mockModule("export async function extractProfileSourceResume(profileId){return globalThis.__sourceProcessingQa.extract(profileId)}"), shortCircuit: true };
    }
    if (specifier.startsWith("@/types/")) {
      return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

globalThis.__sourceProcessingQa = { db: null, extract: null };
const { assessResumeExtraction } = await import("../src/features/document-generation/resume-processing-readiness.ts");
const { processResumeProcessingJobs } = await import("../src/features/document-generation/resume-processing-service.ts");

const profileId = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const lease = "44444444-4444-4444-8444-444444444444";

function extraction(normalizedText) {
  return {
    sourceFileId: fileId,
    sourceMimeType: "application/pdf",
    sourceExtension: "pdf",
    extractor: "pdfjs-dist",
    rawText: normalizedText,
    normalizedText,
    pageCount: 1,
    warnings: [],
    status: "success",
    failureReason: null,
  };
}

const supported = extraction([
  "Professional Summary",
  "Operations leader with verified experience in fictional organizations.",
  "Experience",
  "Operations Manager | Example Company | Jan 2020 - Present",
  "- Improved a documented internal process",
  "Skills",
  "Operations, Reporting",
].join("\n"));

function setupWorker(source = supported, failureAck = true) {
  const calls = [];
  let claimCount = 0;
  globalThis.__sourceProcessingQa.extract = async (requestedProfileId) => {
    assert.equal(requestedProfileId, profileId);
    return source;
  };
  globalThis.__sourceProcessingQa.db = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "claim_resume_processing_job") {
        claimCount++;
        return claimCount === 1 ? { data: [{
          job_id: jobId,
          candidate_profile_id: profileId,
          source_file_id: fileId,
          source_content_sha256: "a".repeat(64),
          lease_token: lease,
        }], error: null } : { data: [], error: null };
      }
      if (name === "fail_resume_processing_job") return { data: failureAck, error: null };
      return { data: true, error: null };
    },
  };
  return calls;
}

test("unambiguous supported career facts still require explicit client confirmation", () => {
  const result = assessResumeExtraction(supported);
  assert.equal(result.outcome, "needs-input");
  assert.equal(result.structuredResult.autoAcceptable, true);
  assert.ok(result.findings.some((item) => item.code === "client-confirmation-required"));
  assert.ok(result.structuredResult.proposals.some((item) => item.section === "employment"));
  assert.match(result.normalizedTextSha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(result.structuredResult).includes("rawText"), false);
});

test("ambiguous or insufficient career facts require targeted client input", () => {
  const ambiguous = assessResumeExtraction(extraction("Experience\nEngineer only\nSkills\nReporting"));
  assert.equal(ambiguous.outcome, "needs-input");
  assert.ok(ambiguous.findings.some((item) => item.code === "ambiguous-career-facts"));
  assert.ok(ambiguous.findings.some((item) => item.code === "missing-substantive-career-history"));

  const unreadable = assessResumeExtraction({
    ...extraction(""), rawText: null, normalizedText: null, extractor: "pdfjs-dist",
    status: "insufficient-text", failureReason: "insufficient-text",
  });
  assert.equal(unreadable.outcome, "needs-input");
  assert.equal(unreadable.structuredResult.proposals.length, 0);
});

test("temporary private-source failures remain retryable", () => {
  const result = assessResumeExtraction({
    ...extraction(""), rawText: null, normalizedText: null, extractor: null,
    status: "failed", failureReason: "source-unavailable",
  });
  assert.deepEqual({ outcome: result.outcome, errorCode: result.errorCode },
    { outcome: "retry", errorCode: "source-unavailable" });
});

test("bounded worker records a clean first source for client review without persisting raw text", async () => {
  const calls = setupWorker();
  assert.deepEqual(await processResumeProcessingJobs(2), { completed: 0, needsInput: 1, failed: 0 });
  const completion = calls.find((call) => call.name === "complete_resume_processing_job");
  assert.equal(completion.args.p_job_id, jobId);
  assert.equal(completion.args.p_lease_token, lease);
  assert.equal(JSON.stringify(completion.args.p_structured_result).includes(supported.normalizedText), false);
  assert.equal(calls.filter((call) => call.name === "claim_resume_processing_job").length, 2);
  assert.equal(completion.args.p_status, "needs-input");
  assert.equal(calls.some((call) => call.name === "accept_automated_resume_processing_job"), false);
});

test("existing canonical facts are never checked by an automatic-acceptance path", async () => {
  const calls = setupWorker(supported);
  assert.deepEqual(await processResumeProcessingJobs(1), { completed: 0, needsInput: 1, failed: 0 });
  const completion = calls.find((call) => call.name === "complete_resume_processing_job");
  assert.equal(completion.args.p_status, "needs-input");
  assert.ok(completion.args.p_readiness_findings.some((item) => item.code === "client-confirmation-required"));
  assert.equal(calls.some((call) => call.name === "resume_profile_is_empty_for_automatic_import"), false);
  assert.equal(calls.some((call) => call.name === "accept_automated_resume_processing_job"), false);
});

test("worker records needs-input and retry outcomes distinctly", async () => {
  let calls = setupWorker(extraction("Experience\nEngineer only"));
  assert.deepEqual(await processResumeProcessingJobs(1), { completed: 0, needsInput: 1, failed: 0 });
  assert.equal(calls.find((call) => call.name === "complete_resume_processing_job").args.p_status, "needs-input");

  calls = setupWorker({
    ...extraction(""), rawText: null, normalizedText: null, extractor: null,
    status: "failed", failureReason: "source-unavailable",
  });
  assert.deepEqual(await processResumeProcessingJobs(1), { completed: 0, needsInput: 0, failed: 1 });
  assert.equal(calls.find((call) => call.name === "fail_resume_processing_job").args.p_error_code, "source-unavailable");
});

test("worker does not report a failure as recorded when its lease update affected no row", async () => {
  setupWorker({
    ...extraction(""), rawText: null, normalizedText: null, extractor: null,
    status: "failed", failureReason: "source-unavailable",
  }, false);
  await assert.rejects(processResumeProcessingJobs(1), /failure could not be recorded/u);
});

test("migration creates a private durable lease queue tied to source-pointer changes", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261103215458_automated_source_processing.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.resume_processing_jobs enable row level security/i);
  assert.match(sql, /revoke all on public\.resume_processing_jobs from public, anon, authenticated/i);
  assert.match(sql, /candidate_profiles_enqueue_source_processing/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /lease_until = now\(\) \+ interval '6 minutes'/i);
  assert.match(sql, /unique \(candidate_profile_id, source_file_id\)/i);
  assert.match(sql, /source-replaced/i);
  assert.doesNotMatch(sql, /grant .*resume_processing_jobs to authenticated/i);
});

test("legacy automatic acceptance remains private while the release path no longer calls it", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261103220738_automated_resume_acceptance.sql", import.meta.url), "utf8");
  assert.match(sql, /review_mode in \('automatic', 'client-confirmed', 'admin-confirmed'\)/i);
  assert.match(sql, /resume_profile_is_empty_for_automatic_import/i);
  assert.match(sql, /not exists \(select 1 from public\.profile_work_experiences/i);
  assert.match(sql, /p_structured_result->>'autoAcceptable' <> 'true'/i);
  assert.match(sql, /jsonb_array_length\(p_readiness_findings\) <> 0/i);
  assert.match(sql, /public\.confirm_resume_review_v2/i);
  assert.match(sql, /set review_mode = 'automatic'/i);
  assert.match(sql, /grant update \(review_mode\) on public\.profile_resume_reviews to service_role/i);
  assert.match(sql, /from public\.user_roles r[\s\S]*r\.role_code = 'client'[\s\S]*r\.candidate_profile_id = v_job\.candidate_profile_id/i);
  assert.match(sql, /revoke all on function public\.accept_automated_resume_processing_job[\s\S]*from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant execute on function public\.accept_automated_resume_processing_job[\s\S]*to authenticated/i);
  const service = readFileSync(new URL("../src/features/document-generation/resume-processing-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(service, /accept_automated_resume_processing_job/i);
  const releaseSql = readFileSync(new URL("../supabase/migrations/20261113124500_client_confirmation_release_fixes.sql", import.meta.url), "utf8");
  assert.match(releaseSql, /r\.source_file_id = v_profile\.existing_resume_file_id/i);
  assert.match(releaseSql, /review_mode in \('client-confirmed', 'admin-confirmed'\)/i);
});
