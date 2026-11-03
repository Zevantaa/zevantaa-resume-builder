import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
  if (specifier === "@/lib/supabase/admin") return {
    url: mock("export function createSupabaseAdminClient(){return globalThis.__dshQa.db}"), shortCircuit: true,
  };
  if (specifier === "./contact-profile-service" &&
      (context.parentURL?.endsWith("client-dashboard-service.ts") || context.parentURL?.endsWith("download-client-document.ts"))) {
    return { url: mock("export async function resolveLinkedClientProfile(){return globalThis.__dshQa.linked()}"), shortCircuit: true };
  }
  if (specifier.startsWith("@/features/")) {
    return nextResolve(new URL(`../src/features/${specifier.slice("@/features/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { buildClientDashboardView } = await import("../src/features/client-portal/client-dashboard-view.ts");
const { getClientDashboardEvidence } = await import("../src/features/client-portal/client-dashboard-service.ts");
const { downloadCurrentClientDocument } = await import("../src/features/client-portal/download-client-document.ts");
const { GET } = await import("../src/app/client/documents/[documentId]/download/route.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");

const own = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const generatedId = "44444444-4444-4444-8444-444444444444";
const documentId = "55555555-5555-4555-8555-555555555555";
const pdfBytes = Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
const stem = buildPdfFilename({ candidateName: "Rohan Kapoor", output: "global-ats-resume" }).replace(/\.pdf$/, "");
const score = { status: "ready", score: 42, benchmark: 90, band: "below-benchmark", breakdown: [], suggestions: [] };
const summary = (packageCode) => ({ fullName: "Rohan Kapoor", primaryEmail: "rohan@example.invalid",
  mobileNumber: "+910000000000", whatsappNumber: null, packageName: "Ignored database label", packageCode, targetMarkets: [] });
const evidence = (packageCode, overrides = {}) => ({ packageCode,
  resume: { fileName: "source.pdf", status: "available", versionNumber: 1 },
  photo: null, reviewConfirmed: true, downloadableDocuments: {}, ...overrides });

function setup() {
  const state = {
    profileId: own, publicBucket: false, downloaded: [],
    profiles: [{ id: own, selected_package_code: "indian-domestic", career_revision: 0, existing_resume_file_id: sourceId,
      gcc_photo_file_id: null, archived_at: null }],
    files: [
      { id: sourceId, candidate_profile_id: own, purpose: "source-resume", original_file_name: "source.pdf",
        status: "available", version_number: 1, archived_at: null },
      { id: generatedId, candidate_profile_id: own, purpose: "generated-document", original_file_name: `${stem}.pdf`,
        status: "available", version_number: 1, access_level: "private", mime_type: "application/pdf",
        file_extension: "pdf", size_bytes: pdfBytes.length, stored_file_name: `${generatedId}.pdf`,
        storage_bucket_name: "candidate-documents-private", storage_object_key: `${own}/${documentId}/${generatedId}.pdf`, archived_at: null },
    ],
    reviews: [{ id: "66666666-6666-4666-8666-666666666666", candidate_profile_id: own, source_file_id: sourceId }],
    documents: [{ id: documentId, candidate_profile_id: own, category: "resume", origin: "generated", status: "available",
      package_code: "indian-domestic", resume_format_family: "global-ats", cover_letter_type: null,
      is_privacy_masked: false, file_name_stem: stem, file_record_id: generatedId,
      output_kind: "global-ats-resume", source_career_revision: 0, version_number: 1,
      generated_at: "2026-10-01", archived_at: null, created_at: "2026-10-01" }],
  };
  const records = { candidate_profiles: state.profiles, file_records: state.files,
    profile_resume_reviews: state.reviews, document_records: state.documents,
    document_regeneration_jobs: [], resume_processing_jobs: [] };
  state.db = {
    from(table) {
      const filters = [];
      const query = {
        select() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { filters.push((row) => row[key] === value); return this; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
        order() { return this; },
        maybeSingle() { return Promise.resolve({ data: records[table].filter((row) => filters.every((f) => f(row)))[0] ?? null, error: null }); },
        then(resolve, reject) { return Promise.resolve({ data: records[table].filter((row) => filters.every((f) => f(row))), error: null }).then(resolve, reject); },
      };
      return query;
    },
    storage: {
      getBucket: async () => ({ data: { public: state.publicBucket }, error: null }),
      from: () => ({ download: async (path) => { state.downloaded.push(path); return { data: new Blob([pdfBytes]), error: null }; } }),
    },
  };
  globalThis.__dshQa = { db: state.db, linked: () => ({ profileId: state.profileId, userId: "77777777-7777-4777-8777-777777777777" }) };
  return state;
}

test("Indian, GCC, EU and Executive dashboards show exactly their entitled outputs", () => {
  for (const [code, expected] of [
    ["indian-domestic", ["global-ats-resume", ...[1, 2, 3, 4, 5].map((n) => `domestic-resume-${n}`)]],
    ["gcc-middle-east", ["global-ats-resume", "gcc-resume"]],
    ["europass-european-union", ["global-ats-resume", "europass-eu-resume"]],
    ["executive-transition-agency-distribution", ["global-ats-resume", ...[1, 2, 3, 4, 5].map((n) => `domestic-resume-${n}`),
      "gcc-resume", "europass-eu-resume", "general-corporate-cover-letter", "international-relocation-cover-letter", "technology-startup-cover-letter"]],
  ]) {
    const view = buildClientDashboardView(summary(code), evidence(code), score);
    assert.deepEqual(view.outputs.map((item) => item.id), expected, code);
    assert.equal(view.routing.displayName.length > 0, true);
    assert.equal(view.routing.atsScoreVisible, true);
    assert.equal(view.routing.gccPhotoAvailable, expected.includes("gcc-resume"));
    assert.ok(view.outputs.every((item) => !item.documentId && item.state !== "Download available"));
  }
});

test("unknown, null, and mismatched package state show no entitlements", () => {
  for (const code of [null, "unknown-package"]) {
    const view = buildClientDashboardView(summary(code), evidence(code), score);
    assert.equal(view.routing, null);
    assert.deepEqual(view.outputs, []);
  }
  assert.deepEqual(buildClientDashboardView(summary("indian-domestic"), evidence("gcc-middle-east"), score).outputs, []);
});

test("profile status uses real upload and review evidence; GCC photo is optional", () => {
  assert.equal(buildClientDashboardView(summary("gcc-middle-east"), evidence("gcc-middle-east", { resume: null }), score).profileStatus, "Profile setup incomplete");
  assert.equal(buildClientDashboardView(summary("gcc-middle-east"), evidence("gcc-middle-east", { reviewConfirmed: false }), score).profileStatus, "Resume processing or input required");
  assert.equal(buildClientDashboardView(summary("gcc-middle-east"), evidence("gcc-middle-east"), { status: "not-ready", benchmark: 90, reasons: [] }).profileStatus, "Profile reviewed/confirmed");
  assert.equal(buildClientDashboardView(summary("gcc-middle-east"), evidence("gcc-middle-east"), score).profileStatus, "Document generation in progress");
  assert.equal(buildClientDashboardView(summary("gcc-middle-east"), evidence("gcc-middle-east"), score).photoAvailable, false);
});

test("dashboard evidence loads only the linked profile and a verified generated record", async () => {
  const state = setup();
  const found = await getClientDashboardEvidence();
  assert.equal(found.reviewConfirmed, true);
  assert.equal(found.resume.fileName, "source.pdf");
  assert.equal(found.downloadableDocuments["global-ats-resume"], documentId);
  state.profileId = other;
  assert.equal(await getClientDashboardEvidence(), null);
});

test("private download succeeds only for an owned, entitled, available generated PDF", async () => {
  const state = setup();
  const response = await GET(new Request("http://localhost:3000/client/documents/x/download"),
    { params: Promise.resolve({ documentId }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.match(response.headers.get("content-disposition"), /Rohan_Kapoor_Global_ATS_Resume\.pdf/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdfBytes);
  assert.deepEqual(state.downloaded, [`${own}/${documentId}/${generatedId}.pdf`]);
});

test("cross-client, forged IDs, removed entitlements and public storage fail closed", async () => {
  const state = setup();
  state.profileId = other;
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  state.profileId = own;
  assert.equal(await downloadCurrentClientDocument("../"), null);
  state.profiles[0].selected_package_code = "gcc-middle-east";
  assert.ok(await downloadCurrentClientDocument(documentId),
    "a historical package code must not hide a still-entitled shared output");
  state.documents[0].output_kind = "domestic-resume-1";
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  state.documents[0].output_kind = "global-ats-resume";
  state.profiles[0].selected_package_code = "indian-domestic";
  state.publicBucket = true;
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  assert.equal(state.downloaded.length, 1);
});

test("tampered file path, wrong file owner and non-PDF records cannot download", async () => {
  const state = setup();
  state.files[1].storage_object_key = `${other}/generated/${generatedId}.pdf`;
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  state.files[1].storage_object_key = `${own}/${documentId}/${generatedId}.pdf`;
  state.files[1].candidate_profile_id = other;
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  state.files[1].candidate_profile_id = own;
  state.files[1].mime_type = "image/png";
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  assert.deepEqual(state.downloaded, []);
});

test("outdated career revisions and privacy-masked employer copies are never client downloads", async () => {
  const state = setup();
  state.profiles[0].career_revision = 1;
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  assert.equal((await getClientDashboardEvidence()).downloadableDocuments["global-ats-resume"], undefined);
  state.profiles[0].career_revision = 0;
  state.documents[0].is_privacy_masked = true;
  state.documents[0].output_kind = "global-ats-employer-masked";
  assert.equal(await downloadCurrentClientDocument(documentId), null);
  assert.equal((await getClientDashboardEvidence()).downloadableDocuments["global-ats-resume"], undefined);
});

test("signed-out and wrong-role callers are denied before private queries", async () => {
  const state = setup();
  globalThis.__dshQa.linked = () => { throw new Error("ACCESS_DENIED"); };
  await assert.rejects(downloadCurrentClientDocument(documentId), /ACCESS_DENIED/);
  await assert.rejects(getClientDashboardEvidence(), /ACCESS_DENIED/);
  assert.deepEqual(state.downloaded, []);
});

test("dashboard remains read-only, preserves ATS display, and uses approved upload flow", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const dashboard = read("src/features/client-portal/client-dashboard-page.tsx");
  const panel = read("src/features/document-generation/indicative-ats-panel.tsx");
  const profile = read("src/features/client-portal/client-intake-form.tsx");
  assert.match(dashboard, /IndicativeAtsPanel result=\{score\}/);
  assert.match(dashboard, /View profile & manage uploads/);
  assert.match(dashboard, /view\.routing\?\.gccPhotoAvailable/);
  assert.match(panel, /result\.score/);
  assert.match(panel, /Target: \{result\.benchmark\}/);
  assert.match(panel, /Internal optimization indicator; not a third-party ATS guarantee/);
  assert.doesNotMatch(profile, /name="(?:fullName|email|mobileNumber|packageCode)"/);
  assert.match(read("src/features/client-portal/client-intake-service.ts"), /values\.photo && !isGccPhotoAvailable/);
});
