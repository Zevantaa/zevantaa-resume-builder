import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: moduleUrl("export {}"), shortCircuit: true };
  if (specifier === "@/lib/supabase/admin") return {
    url: moduleUrl("export function createSupabaseAdminClient(){return globalThis.__doc13.db}"), shortCircuit: true,
  };
  if (specifier === "@/features/authentication/authorization") return {
    url: moduleUrl("export async function requireApplicationRole(role){if(role!=='admin'||!globalThis.__doc13.admin)throw Error('ACCESS_DENIED');return {userId:'admin-test'}}"), shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/admin-global-ats-service" ||
      (specifier === "./admin-global-ats-service" && context.parentURL?.endsWith("persistent-document-service.ts"))) return {
    url: moduleUrl("export async function loadCandidateProfileById(id){return id===globalThis.__doc13.profile.id?globalThis.__doc13.profile:null}"), shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/gcc-photo-service" ||
      (specifier === "./gcc-photo-service" && context.parentURL?.endsWith("persistent-document-service.ts"))) return {
    url: moduleUrl("export async function loadTrustedGccPhoto(){return null}"), shortCircuit: true,
  };
  if (specifier === "./pdf/render-pdf" && context.parentURL?.endsWith("persistent-document-service.ts")) return {
    url: moduleUrl("export async function renderPdfDocument(){if(globalThis.__doc13.renderFail)throw Error('render failed');return globalThis.__doc13.pdf}"), shortCircuit: true,
  };
  if (specifier.startsWith("@/features/")) return nextResolve(new URL(`../src/features/${specifier.slice("@/features/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { generateAndPersistDocument, generateAndPersistAdminDocument, assertGeneratedPdf } =
  await import("../src/features/document-generation/persistent-document-service.ts");
const { processDocumentRegenerationJobs, processGlobalDocumentRegenerationJobs } = await import("../src/features/document-generation/document-regeneration-service.ts");
const { V1_DOCUMENT_OUTPUTS } = await import("../src/features/document-generation/package-routing.ts");
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function setup() {
  const profile = createLongGlobalAtsQaProfile();
  profile.selectedPackage = "executive-transition-agency-distribution";
  const state = {
    admin: true, profile, revision: 0, renderFail: false, uploadFail: false,
    downloadFail: false, publishFail: false, removeFail: false, pdf: new Uint8Array(Buffer.from(
      "%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\nstartxref\n9\n%%EOF\n")),
    objects: new Map(), docs: [], files: [], removed: [], jobs: [],
  };
  const table = (name) => {
    const filters = [];
    const rows = () => name === "candidate_profiles"
      ? [{ id: profile.id, career_revision: state.revision, selected_package_code: profile.selectedPackage }]
      : name === "document_records" ? state.docs : [];
    return {
      select() { return this; }, eq(key, value) { filters.push((row) => row[key] === value); return this; },
      is(key, value) { filters.push((row) => (row[key] ?? null) === value); return this; },
      maybeSingle: async () => ({ data: rows().find((row) => filters.every((filter) => filter(row))) ?? null, error: null }),
    };
  };
  state.db = {
    from: table,
    storage: {
      getBucket: async () => ({ data: { public: false }, error: null }),
      from: () => ({
        upload: async (key, bytes) => {
          if (state.uploadFail) return { error: new Error("upload failed") };
          state.objects.set(key, new Uint8Array(bytes)); return { error: null };
        },
        download: async (key) => state.downloadFail ? { data: null, error: new Error("verification failed") }
          : { data: new Blob([new Uint8Array(state.objects.get(key) ?? [])]), error: null },
        remove: async (keys) => { state.removed.push(...keys); if (state.removeFail) return { error: new Error("cleanup failed") };
          keys.forEach((key) => state.objects.delete(key)); return { error: null }; },
      }),
    },
    rpc: async (name, args) => {
      if (name === "record_ats_assessment_snapshot") {
        return { data: "ats-snapshot", error: null };
      }
      if (name === "claim_document_regeneration_job") {
        const job = state.jobs.find((entry) => entry.status === "pending" &&
          (args.p_profile_id === null || entry.candidate_profile_id === args.p_profile_id));
        if (!job) return { data: [], error: null };
        job.status = "processing";
        job.lease_token = `lease-${job.job_id}`;
        return { data: [{ ...job, actor_user_id: job.actor_user_id }], error: null };
      }
      if (name === "fail_document_regeneration_job") {
        const job = state.jobs.find((entry) => entry.job_id === args.p_job_id && entry.lease_token === args.p_lease_token);
        if (job) job.status = "failed";
        return { data: !!job, error: null };
      }
      if (name !== "publish_generated_document" || state.publishFail) return { data: null, error: new Error("publication failed") };
      if (args.p_job_id) {
        const job = state.jobs.find((entry) => entry.job_id === args.p_job_id &&
          entry.lease_token === args.p_lease_token && entry.status === "processing" &&
          entry.source_career_revision === args.p_career_revision);
        if (!job) return { data: null, error: new Error("stale lease") };
        job.status = "completed";
      }
      const previous = state.docs.filter((row) => row.output_kind === args.p_output_kind);
      const version = previous.length + 1;
      for (const row of previous) if (row.status === "available") row.status = "superseded";
      state.files.push({ id: args.p_file_id, key: args.p_object_key });
      state.docs.push({ id: args.p_document_id, candidate_profile_id: profile.id, output_kind: args.p_output_kind,
        source_career_revision: args.p_career_revision, file_record_id: args.p_file_id,
        version_number: version, status: "available" });
      return { data: [{ published_document_id: args.p_document_id, published_version: version }], error: null };
    },
  };
  globalThis.__doc13 = state;
  return state;
}

test("all eleven candidate outputs and masked export publish under separate stable identities", async () => {
  const state = setup();
  for (const output of [...V1_DOCUMENT_OUTPUTS, "global-ats-employer-masked"]) {
    const result = await generateAndPersistDocument(state.profile.id, output, { actorUserId: "admin-test" });
    assert.equal(result.version, 1);
    assert.ok(state.objects.has(`${state.profile.id}/${result.id}/${state.docs.at(-1).file_record_id}.pdf`));
  }
  assert.deepEqual(new Set(state.docs.map((row) => row.output_kind)),
    new Set([...V1_DOCUMENT_OUTPUTS, "global-ats-employer-masked"]));
  assert.equal(state.docs.filter((row) => row.output_kind === "global-ats-resume" && row.status === "available").length, 1);
});

test("v2 supersedes v1 without deleting history; upload, readback and publication failures preserve v1", async () => {
  const state = setup();
  const first = await generateAndPersistDocument(state.profile.id, "global-ats-resume", { actorUserId: "admin-test" });
  for (const failure of ["renderFail", "uploadFail", "downloadFail", "publishFail"]) {
    state[failure] = true;
    await assert.rejects(generateAndPersistDocument(state.profile.id, "global-ats-resume", { actorUserId: "admin-test" }));
    state[failure] = false;
    assert.equal(state.docs.length, 1);
    assert.equal(state.docs[0].status, "available");
    assert.ok([...state.objects.keys()].some((key) => key.includes(first.id)));
  }
  const second = await generateAndPersistDocument(state.profile.id, "global-ats-resume", { actorUserId: "admin-test" });
  assert.equal(second.version, 2);
  assert.deepEqual(state.docs.map((row) => row.status), ["superseded", "available"]);
  assert.equal(state.objects.size, 2);
});

test("invalid generated bytes, stale revision and non-admin generation fail closed", async () => {
  const state = setup();
  assert.throws(() => assertGeneratedPdf(new Uint8Array(Buffer.from("not a PDF"))));
  state.pdf = new Uint8Array(Buffer.from("%PDF-1.7\nmissing trailer"));
  await assert.rejects(generateAndPersistDocument(state.profile.id, "global-ats-resume", { actorUserId: "admin-test" }));
  assert.equal(state.objects.size, 0);
  state.admin = false;
  await assert.rejects(generateAndPersistAdminDocument(state.profile.id, "global-ats-resume"), /ACCESS_DENIED/);
});

test("bounded job claims publish the current revision once; failed work remains recorded", async () => {
  const state = setup();
  state.jobs.push({ job_id: "job-1", candidate_profile_id: state.profile.id,
    output_kind: "global-ats-resume", source_career_revision: 0, status: "pending" });
  assert.deepEqual(await processDocumentRegenerationJobs(state.profile.id, "admin-test", 1),
    { completed: 1, failed: 0 });
  assert.equal(state.jobs[0].status, "completed");
  assert.equal(state.docs.length, 1);
  assert.deepEqual(await processDocumentRegenerationJobs(state.profile.id, "admin-test", 1),
    { completed: 0, failed: 0 });
  state.jobs.push({ job_id: "job-2", candidate_profile_id: state.profile.id,
    output_kind: "gcc-resume", source_career_revision: 0, status: "pending" });
  state.uploadFail = true;
  assert.deepEqual(await processDocumentRegenerationJobs(state.profile.id, "admin-test", 1),
    { completed: 0, failed: 1 });
  assert.equal(state.jobs[1].status, "failed");
  assert.equal(state.docs.length, 1);
});

test("global bounded claims use the active linked client provenance actor", async () => {
  const state = setup();
  state.jobs.push({ job_id: "global-job", candidate_profile_id: state.profile.id,
    output_kind: "global-ats-resume", source_career_revision: 0, status: "pending",
    actor_user_id: "client-test" });
  assert.deepEqual(await processGlobalDocumentRegenerationJobs(1), { completed: 1, failed: 0 });
  assert.equal(state.jobs[0].status, "completed");
  assert.equal(state.docs.length, 1);
});

test("stale career revision and an unentitled job cannot publish a current document", async () => {
  const state = setup();
  state.revision = 2;
  state.jobs.push({ job_id: "stale-job", candidate_profile_id: state.profile.id,
    output_kind: "global-ats-resume", source_career_revision: 1, status: "pending" });
  assert.deepEqual(await processDocumentRegenerationJobs(state.profile.id, "admin-test", 1),
    { completed: 0, failed: 1 });
  state.profile.selectedPackage = "indian-domestic";
  state.jobs.push({ job_id: "unentitled-job", candidate_profile_id: state.profile.id,
    output_kind: "gcc-resume", source_career_revision: 2, status: "pending" });
  assert.deepEqual(await processDocumentRegenerationJobs(state.profile.id, "admin-test", 1),
    { completed: 0, failed: 1 });
  assert.equal(state.docs.length, 0);
});

test("cleanup failure leaves a private orphan but never changes the existing current version", async () => {
  const state = setup();
  await generateAndPersistDocument(state.profile.id, "global-ats-resume", { actorUserId: "admin-test" });
  state.publishFail = true;
  state.removeFail = true;
  await assert.rejects(generateAndPersistDocument(state.profile.id, "global-ats-resume",
    { actorUserId: "admin-test" }), /cleanup requires review/);
  assert.equal(state.docs.length, 1);
  assert.equal(state.docs[0].status, "available");
  assert.equal(state.objects.size, 2);
});

test("migration keeps dedicated private bucket, output uniqueness, leases and service-only grants", () => {
  const sql = source("supabase/migrations/20261019064608_doc_13_document_lifecycle.sql");
  assert.match(sql, /candidate-documents-private/);
  assert.match(sql, /public = false/);
  assert.match(sql, /document_records_one_current_output_idx/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /source_career_revision = new\.career_revision, status = 'pending'/);
  assert.match(sql, /d\.status in \('available', 'outdated'\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant execute on function public\.publish_generated_document[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant .*document_regeneration_jobs to authenticated/);
});

test("entitlement orchestration enqueues exact outputs and preserves inaccessible history", () => {
  const sql = source("supabase/migrations/20261103221521_automated_entitlement_orchestration.sql");
  assert.match(sql, /when 'executive-transition-agency-distribution' then[\s\S]*p_output <> 'global-ats-employer-masked'/i);
  assert.match(sql, /profile_resume_reviews_enqueue_outputs/i);
  assert.match(sql, /candidate_profiles_reconcile_package_outputs/i);
  assert.match(sql, /perform public\.enqueue_entitled_document_outputs\(new\.id\)/i);
  assert.match(sql, /set status = 'outdated'[\s\S]*not public\.is_v1_output_entitled/i);
  assert.match(sql, /last_error_code = 'no-longer-entitled'/i);
  assert.match(sql, /on conflict \(candidate_profile_id, output_kind, source_career_revision\)/i);
  assert.match(sql, /p_profile_id is null or q\.candidate_profile_id = p_profile_id/i);
  assert.match(sql, /for update of q skip locked/i);
  assert.match(sql, /document_regeneration_jobs_global_claim_idx/i);
  assert.match(sql, /revoke all on function public\.enqueue_entitled_document_outputs\(uuid\)[\s\S]*from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /delete from public\.document_records/i);
});
