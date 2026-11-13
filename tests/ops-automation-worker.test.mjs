import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { afterEach, test } from "node:test";

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/features/document-generation/resume-processing-service") return {
    url: moduleUrl("export async function processResumeProcessingJobs(limit){return globalThis.__automationQa.source(limit)}"), shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/document-regeneration-service") return {
    url: moduleUrl("export async function processGlobalDocumentRegenerationJobs(limit){return globalThis.__automationQa.documents(limit)}"), shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/document-ats-assessment-service") return {
    url: moduleUrl("export async function processDocumentAtsAssessmentJobs(limit){return globalThis.__automationQa.assessments(limit)}"), shortCircuit: true,
  };
  return nextResolve(specifier, context);
} });

globalThis.__automationQa = { source: null, documents: null, assessments: null };
const { POST, maxDuration, runtime } = await import("../src/app/api/internal/automation/route.ts");
const previousSecret = process.env.AUTOMATION_WORKER_SECRET;
afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTOMATION_WORKER_SECRET;
  else process.env.AUTOMATION_WORKER_SECRET = previousSecret;
});

const request = (token) => new Request("https://resume.example.test/api/internal/automation", {
  method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {},
});

test("automation route is Node-only, bounded and fails closed without its bearer secret", async () => {
  assert.equal(runtime, "nodejs");
  assert.equal(maxDuration, 300);
  delete process.env.AUTOMATION_WORKER_SECRET;
  assert.equal((await POST(request(null))).status, 401);
  process.env.AUTOMATION_WORKER_SECRET = "fixture-automation-secret-at-least-32-characters";
  assert.equal((await POST(request("wrong-secret-that-is-still-long-enough"))).status, 401);
});

test("authorized invocation processes one job from each durable queue", async () => {
  const token = "fixture-automation-secret-at-least-32-characters";
  process.env.AUTOMATION_WORKER_SECRET = token;
  const limits = [];
  globalThis.__automationQa.source = async (limit) => { limits.push(["source", limit]); return { completed: 1, needsInput: 0, failed: 0 }; };
  globalThis.__automationQa.documents = async (limit) => { limits.push(["documents", limit]); return { completed: 1, failed: 0 }; };
  globalThis.__automationQa.assessments = async (limit) => { limits.push(["assessments", limit]); return { completed: 1, unavailable: 0, failed: 0 }; };
  const response = await POST(request(token));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(limits, [["source", 1], ["documents", 1], ["assessments", 1]]);
  assert.deepEqual(await response.json(), { ok: true, source: { completed: 1, needsInput: 0, failed: 0 }, documents: { completed: 1, failed: 0 }, assessments: { completed: 1, unavailable: 0, failed: 0 } });
});

test("one queue failure does not prevent bounded progress in the other", async () => {
  const token = "fixture-automation-secret-at-least-32-characters";
  process.env.AUTOMATION_WORKER_SECRET = token;
  globalThis.__automationQa.source = async () => { throw new Error("private detail"); };
  globalThis.__automationQa.documents = async () => ({ completed: 1, failed: 0 });
  globalThis.__automationQa.assessments = async () => ({ completed: 0, unavailable: 1, failed: 0 });
  const response = await POST(request(token));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, source: { completed: 0, needsInput: 0, failed: 0 }, documents: { completed: 1, failed: 0 }, assessments: { completed: 0, unavailable: 1, failed: 0 } });
});

test("scheduler migration stores no secret and requires explicit owner activation", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261103222143_supabase_automation_scheduler.sql", import.meta.url), "utf8");
  assert.match(sql, /create extension if not exists pg_cron/i);
  assert.match(sql, /create extension if not exists pg_net/i);
  assert.match(sql, /from vault\.decrypted_secrets/i);
  assert.match(sql, /'zevantaa-automation-worker',[\s\S]*'\* \* \* \* \*'/i);
  assert.match(sql, /timeout_milliseconds := 290000/i);
  assert.match(sql, /revoke all on function public\.configure_zevantaa_automation_schedule\(\)[\s\S]*service_role/i);
  assert.doesNotMatch(sql, /select public\.configure_zevantaa_automation_schedule\(\);/i);
  assert.doesNotMatch(sql, /Bearer [A-Za-z0-9_-]{20,}/i);
});
