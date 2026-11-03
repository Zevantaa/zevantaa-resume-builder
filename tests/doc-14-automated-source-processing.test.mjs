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

function setupWorker(source = supported) {
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
      return { data: true, error: null };
    },
  };
  return calls;
}

test("unambiguous supported career facts pass the conservative automatic gate", () => {
  const result = assessResumeExtraction(supported);
  assert.equal(result.outcome, "completed");
  assert.equal(result.structuredResult.autoAcceptable, true);
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

test("bounded worker completes a claimed job without persisting raw text", async () => {
  const calls = setupWorker();
  assert.deepEqual(await processResumeProcessingJobs(2), { completed: 1, needsInput: 0, failed: 0 });
  const completion = calls.find((call) => call.name === "complete_resume_processing_job");
  assert.equal(completion.args.p_status, "completed");
  assert.equal(completion.args.p_job_id, jobId);
  assert.equal(completion.args.p_lease_token, lease);
  assert.equal(JSON.stringify(completion.args.p_structured_result).includes(supported.normalizedText), false);
  assert.equal(calls.filter((call) => call.name === "claim_resume_processing_job").length, 2);
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

test("migration creates a private durable lease queue tied to source-pointer changes", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261103215458_automated_source_processing.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.resume_processing_jobs enable row level security/i);
  assert.match(sql, /revoke all on public\.resume_processing_jobs from public, anon, authenticated/i);
  assert.match(sql, /candidate_profiles_enqueue_source_processing/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /lease_until = now\(\) \+ interval '5 minutes'/i);
  assert.match(sql, /unique \(candidate_profile_id, source_file_id\)/i);
  assert.match(sql, /source-replaced/i);
  assert.doesNotMatch(sql, /grant .*resume_processing_jobs to authenticated/i);
});
