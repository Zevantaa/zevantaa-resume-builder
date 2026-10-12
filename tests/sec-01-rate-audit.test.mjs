import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
  if (specifier === "../supabase/admin" && context.parentURL?.includes("/security/")) {
    return { url: mock("export function createSupabaseAdminClient(){return globalThis.__securityDb}"), shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });

const { enforceRateLimit, RateLimitError } = await import("../src/lib/security/rate-limit.ts");
const { recordSecurityEvent } = await import("../src/lib/security/audit-events.ts");
const priorNodeEnv = process.env.NODE_ENV;
const priorKey = process.env.SECURITY_RATE_LIMIT_KEY;

test("production rate limiter fails closed without a key or database counter", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.SECURITY_RATE_LIMIT_KEY;
  try {
    await assert.rejects(enforceRateLimit("career-save", "fictional-user", 20), RateLimitError);
    process.env.SECURITY_RATE_LIMIT_KEY = "replace-with-independent-random-32-plus-character-secret";
    await assert.rejects(enforceRateLimit("career-save", "fictional-user", 20), RateLimitError);
    process.env.SECURITY_RATE_LIMIT_KEY = "fictional-test-only-key-32-characters-minimum";
    globalThis.__securityDb = { rpc: async () => ({ data: null, error: new Error("unavailable") }) };
    await assert.rejects(enforceRateLimit("career-save", "fictional-user", 20), RateLimitError);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
    if (priorKey === undefined) delete process.env.SECURITY_RATE_LIMIT_KEY; else process.env.SECURITY_RATE_LIMIT_KEY = priorKey;
  }
});

test("rate limit hashes identity and uses bounded atomic RPC", async () => {
  process.env.SECURITY_RATE_LIMIT_KEY = "fictional-test-only-key-32-characters-minimum";
  let called;
  globalThis.__securityDb = { async rpc(name, params) { called = { name, params }; return { data: true, error: null }; } };
  try {
    await enforceRateLimit("pdf-generation", "fictional-user", 40);
    assert.equal(called.name, "consume_application_rate_limit");
    assert.match(called.params.p_subject_hash, /^[0-9a-f]{64}$/);
    assert.equal(JSON.stringify(called).includes("fictional-user"), false);
    assert.equal(called.params.p_limit, 40);
    await assert.rejects(enforceRateLimit("pdf-generation", "", 40), RateLimitError);
  } finally {
    if (priorKey === undefined) delete process.env.SECURITY_RATE_LIMIT_KEY; else process.env.SECURITY_RATE_LIMIT_KEY = priorKey;
  }
});

test("audit writer inserts only allowlisted event fields, never document content", async () => {
  let payload;
  globalThis.__securityDb = { from(table) { assert.equal(table, "security_audit_events"); return {
    async insert(value) { payload = value; return { error: null }; },
  }; } };
  const result = await recordSecurityEvent({ eventType: "client.career.saved", actorUserId: "fictional-user", outcome: "success" });
  assert.equal(result, true);
  assert.deepEqual(payload.metadata, {});
  assert.deepEqual(Object.keys(payload).sort(),
    ["actor_user_id", "candidate_profile_id", "event_type", "metadata", "outcome", "target_user_id"].sort());
});

test("package assignment audit uses controlled detail without candidate content", async () => {
  let payload;
  globalThis.__securityDb = { from(table) { assert.equal(table, "security_audit_events"); return {
    async insert(value) { payload = value; return { error: null }; },
  }; } };
  assert.equal(await recordSecurityEvent({ eventType: "client.account.updated", actorUserId: "fictional-admin",
    targetUserId: "fictional-client", outcome: "success", detailCode: "package-assignment" }), true);
  assert.deepEqual(payload.metadata, { detail_code: "package-assignment" });
  assert.equal(JSON.stringify(payload).includes("resume content"), false);
});
