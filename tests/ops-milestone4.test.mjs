import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
  if (specifier === "@/lib/supabase/admin") return { url: mock("export function createSupabaseAdminClient(){return globalThis.__m4.db}"), shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return { url: mock("export async function requireApplicationRole(role){return globalThis.__m4.authorize(role)}"), shortCircuit: true };
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/u.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

globalThis.__m4 = {};
const { getAdminWorkflowOverview } = await import("../src/features/admin-portal/admin-workflow-service.ts");

function setup(denied = false) {
  const records = {
    client_onboarding_invitations: [
      { id: "i1", candidate_profile_id: "p1", delivery_status: "sent", accepted_at: "2026-11-11T08:30:00Z", last_error_code: null, attempt_count: 1, updated_at: "2026-11-11T08:00:00Z" },
      { id: "i2", candidate_profile_id: "p2", delivery_status: "failed", last_error_code: "delivery-failed", attempt_count: 2, updated_at: "2026-11-11T09:00:00Z" },
    ],
    resume_processing_jobs: [
      { id: "r1", candidate_profile_id: "p1", status: "needs-input", last_error_code: null, attempts: 1, updated_at: "2026-11-11T07:00:00Z" },
    ],
    document_regeneration_jobs: [
      { id: "d1", candidate_profile_id: "p1", status: "pending", last_error_code: null, attempts: 0, updated_at: "2026-11-11T06:00:00Z" },
      { id: "d2", candidate_profile_id: "p2", status: "failed", last_error_code: "generation-failed", attempts: 3, updated_at: "2026-11-11T10:00:00Z" },
    ],
    document_records: [{ id: "o1", origin: "generated", status: "available", archived_at: null }],
  };
  const db = { from(table) {
    const filters = []; let head = false; let max = Infinity; let sort;
    const output = () => {
      let data = records[table].filter((row) => filters.every((filter) => filter(row)));
      if (sort) data = [...data].sort((a, b) => String(b[sort]).localeCompare(String(a[sort])));
      data = data.slice(0, max);
      return { data: head ? null : data, count: head ? data.length : null, error: null };
    };
    return { select(_columns, options) { head = options?.head === true; return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      not(key, _operator, value) { filters.push((row) => row[key] !== value); return this; },
      is(key, value) { filters.push((row) => row[key] === value); return this; },
      order(key) { sort = key; return this; }, limit(value) { max = value; return this; },
      then(resolve, reject) { return Promise.resolve(output()).then(resolve, reject); } };
  } };
  globalThis.__m4 = { db, authorize(role) { assert.equal(role, "admin"); if (denied) throw new Error("denied"); } };
}

test("admin workflow reports genuine durable states and controlled actionable errors", async () => {
  setup();
  const result = await getAdminWorkflowOverview();
  assert.deepEqual(result.onboarding, { notSent: 0, pending: 0, sent: 1, failed: 1, activated: 1, awaitingActivation: 0 });
  assert.equal(result.extraction.needsInput, 1);
  assert.equal(result.generation.pending, 1);
  assert.equal(result.availableDocuments, 1);
  assert.deepEqual(result.errors.map(({ area, code }) => ({ area, code })), [
    { area: "Document generation", code: "generation-failed" },
    { area: "Invitation", code: "delivery-failed" },
  ]);
});

test("client and signed-out callers cannot read operational workflow state", async () => {
  setup(true);
  await assert.rejects(getAdminWorkflowOverview(), /denied/u);
});

test("onboarding migration is forward-only, private, constrained, and stores no password or token", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261111085249_client_onboarding_invitation_state.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.client_onboarding_invitations/iu);
  assert.match(sql, /enable row level security/iu);
  assert.match(sql, /revoke all .* from public, anon, authenticated/isu);
  assert.match(sql, /grant select, insert, update .* to service_role/isu);
  assert.match(sql, /unique \(candidate_profile_id\)/iu);
  assert.doesNotMatch(sql, /\b(password|token_hash|access_token|refresh_token)\s+(text|json|jsonb|bytea)/iu);
  assert.doesNotMatch(sql, /drop table|delete from|truncate/iu);
});

test("navigation avoids the auth-branding waterfall and client listing avoids Auth N+1 calls", () => {
  for (const path of ["src/app/admin/layout.tsx", "src/app/client/layout.tsx"]) {
    assert.match(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), /Promise\.all\(\[\s*requireApplicationRole/isu);
  }
  const service = readFileSync(new URL("../src/features/admin-portal/client-account-service.ts", import.meta.url), "utf8");
  const listBody = service.slice(service.indexOf("export async function listProvisionedClients"), service.indexOf("export async function getProvisionedClient"));
  assert.doesNotMatch(listBody, /getUserById/iu);
  assert.match(listBody, /primary_email/iu);
});
