import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  const mocks = {
    "server-only": "export {}",
    "@/lib/supabase/admin": "export function createSupabaseAdminClient(){return globalThis.__clientInputQa.db}",
    "@/features/authentication/authorization": "export async function requireApplicationRole(role){if(role!=='client')throw Error('role');return {userId:globalThis.__clientInputQa.userId}}",
    "next/cache": "export function revalidatePath(path){globalThis.__clientInputQa.revalidated=path}",
  };
  if (specifier in mocks) return { url: moduleUrl(mocks[specifier]), shortCircuit: true };
  if (specifier === "./contact-profile-service" && context.parentURL?.endsWith("client-resume-input-service.ts")) {
    return { url: moduleUrl("export async function resolveLinkedClientProfile(){return globalThis.__clientInputQa.linked}"), shortCircuit: true };
  }
  if (specifier.startsWith("@/features/")) return nextResolve(new URL(`../src/features/${specifier.slice("@/features/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("@/lib/")) return nextResolve(new URL(`../src/lib/${specifier.slice("@/lib/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const profileId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const proposal = {
  id: "employment:4", section: "employment", sourceLines: [4], fields: {
    jobTitle: "Engineer", employerName: "Example Company", location: "Pune",
    startDate: "2020-01", endDate: "", isCurrentRole: "true",
    description: "Supported source detail", highlights: "Verified result",
  },
};

function setup() {
  const state = {
    userId, linked: { profileId, userId }, calls: [], revalidated: null,
    rows: {
      candidate_profiles: [{ id: profileId, existing_resume_file_id: sourceId, archived_at: null }],
      resume_processing_jobs: [{ id: jobId, candidate_profile_id: profileId, source_file_id: sourceId,
        status: "needs-input", structured_result: { proposals: [proposal] },
        readiness_findings: [{ code: "ambiguous-career-facts", message: "Review highlighted details." }] }],
    },
  };
  state.db = {
    from(name) {
      const filters = [];
      return {
        select() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { filters.push((row) => row[key] === value); return this; },
        maybeSingle: async () => ({ data: (state.rows[name] ?? []).find((row) => filters.every((filter) => filter(row))) ?? null, error: null }),
      };
    },
    rpc: async (name, args) => {
      state.calls.push({ name, args });
      return { data: name === "confirm_client_canonical_resume_input" ? true : "55555555-5555-4555-8555-555555555555", error: null };
    },
  };
  globalThis.__clientInputQa = state;
  return state;
}

const { getClientResumeInputReview } = await import("../src/features/client-portal/client-resume-input-service.ts");
const { confirmClientResumeProposalsAction, confirmCanonicalResumeProfileAction } =
  await import("../src/features/client-portal/confirm-client-resume-input-action.ts");

function proposalForm(overrides = {}) {
  const form = new FormData();
  form.set("jobId", overrides.jobId ?? jobId);
  form.set("confirmReview", "yes");
  form.set(`accept:${proposal.id}`, "on");
  for (const [key, value] of Object.entries(proposal.fields)) form.set(`field:${proposal.id}:${key}`, value);
  return form;
}

test("client loads only the current linked needs-input job without raw resume text", async () => {
  setup();
  const review = await getClientResumeInputReview();
  assert.equal(review.jobId, jobId);
  assert.deepEqual(review.proposals, [proposal]);
  assert.equal(JSON.stringify(review).includes("rawText"), false);
});

test("client confirmation submits only stored proposal identities through the atomic RPC", async () => {
  const state = setup();
  const result = await confirmClientResumeProposalsAction({ ok: false, message: "" }, proposalForm());
  assert.equal(result.ok, true);
  const call = state.calls[0];
  assert.equal(call.name, "confirm_client_resume_processing_input");
  assert.equal(call.args.p_job_id, jobId);
  assert.equal(call.args.p_actor_user_id, userId);
  assert.equal(call.args.p_approved[0].id, proposal.id);
  assert.equal(state.revalidated, "/client");
});

test("stale job identity and incomplete career values fail before canonical writes", async () => {
  let state = setup();
  assert.equal((await confirmClientResumeProposalsAction({ ok: false, message: "" }, proposalForm({ jobId: "stale" }))).ok, false);
  assert.equal(state.calls.length, 0);
  state = setup();
  const invalid = proposalForm();
  invalid.set(`field:${proposal.id}:startDate`, "approximately 2020");
  assert.equal((await confirmClientResumeProposalsAction({ ok: false, message: "" }, invalid)).ok, false);
  assert.equal(state.calls.length, 0);
});

test("explicit canonical-profile confirmation uses its dedicated readiness RPC", async () => {
  const state = setup();
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("confirmCanonical", "yes");
  assert.equal((await confirmCanonicalResumeProfileAction({ ok: false, message: "" }, form)).ok, true);
  assert.equal(state.calls[0].name, "confirm_client_canonical_resume_input");
});

test("migration binds input to active client, current source and stored proposals", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261103222518_client_resume_input_confirmation.sql", import.meta.url), "utf8");
  assert.match(sql, /j\.status = 'needs-input'/i);
  assert.match(sql, /p\.existing_resume_file_id = j\.source_file_id/i);
  assert.match(sql, /r\.user_id = p_actor_user_id[\s\S]*r\.candidate_profile_id = v_job\.candidate_profile_id/i);
  assert.match(sql, /stored->>'id' = approved->>'id'/i);
  assert.match(sql, /stored->'sourceLines' = approved->'sourceLines'/i);
  assert.match(sql, /set review_mode = 'client-confirmed'/i);
  assert.match(sql, /input_confirmed_by_user_id = p_actor_user_id/i);
  assert.match(sql, /perform public\.enqueue_entitled_document_outputs/i);
  assert.match(sql, /revoke all on function public\.confirm_client_resume_processing_input[\s\S]*from public, anon, authenticated/i);
});
