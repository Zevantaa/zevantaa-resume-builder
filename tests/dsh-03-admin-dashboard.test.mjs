import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
  if (specifier === "@/lib/supabase/admin") return { url: mock("export function createSupabaseAdminClient(){return globalThis.__adminQa.db}"), shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return { url: mock("export async function requireApplicationRole(role){globalThis.__adminQa.authorize(role)}"), shortCircuit: true };
  if (specifier === "./client-account-service" && context.parentURL?.endsWith("admin-stored-document-service.ts")) {
    return { url: mock("export async function getProvisionedClient(id){return globalThis.__adminQa.client(id)}"), shortCircuit: true };
  }
  if (specifier.startsWith("@/features/")) return nextResolve(new URL(`../src/features/${specifier.slice("@/features/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("@/lib/")) return nextResolve(new URL(`../src/lib/${specifier.slice("@/lib/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { parseAdminDirectoryFilters, filterAdminDirectory, directoryHref, packageNameForDirectory,
  getAdminResumeStatus } = await import("../src/features/admin-portal/admin-directory-model.ts");
const { getAdminDirectoryData, getAdminStoredDocuments } = await import("../src/features/admin-portal/admin-directory-service.ts");
const { downloadAdminStoredDocument } = await import("../src/features/admin-portal/admin-stored-document-service.ts");
const { GET } = await import("../src/app/admin/clients/[userId]/documents/[documentId]/download/route.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");

const p1 = "11111111-1111-4111-8111-111111111111";
const p2 = "22222222-2222-4222-8222-222222222222";
const p3 = "33333333-3333-4333-8333-333333333333";
const p4 = "44444444-4444-4444-8444-444444444444";
const u1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const u2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const u3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const u4 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const s2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const s3 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const s4 = "88888888-8888-4888-8888-888888888888";
const f3 = "99999999-9999-4999-8999-999999999999";
const d3 = "77777777-7777-4777-8777-777777777777";
const bytes = Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
const stem = buildPdfFilename({ candidateName: "Cora Vale", output: "global-ats-resume" }).replace(/\.pdf$/u, "");

function setup() {
  const state = {
    denied: false, publicBucket: false, queries: [], downloaded: [],
    records: {
      user_roles: [
        { user_id: u1, candidate_profile_id: p1, account_status: "active", role_code: "client" },
        { user_id: u2, candidate_profile_id: p2, account_status: "active", role_code: "client" },
        { user_id: u3, candidate_profile_id: p3, account_status: "active", role_code: "client" },
        { user_id: u4, candidate_profile_id: p4, account_status: "disabled", role_code: "client" },
      ],
      candidate_profiles: [
        { id: p1, full_name: "Asha Example", primary_email: "asha@example.invalid", mobile_number: "+910000000001", whatsapp_number: null, linkedin_url: null, selected_package_code: "indian-domestic", existing_resume_file_id: null, archived_at: null },
        { id: p2, full_name: "Bela Fiction", primary_email: "bela@example.invalid", mobile_number: "+971000000002", whatsapp_number: "+971000000022", linkedin_url: "https://linkedin.com/in/bela-fiction", selected_package_code: "gcc-middle-east", existing_resume_file_id: s2, archived_at: null },
        { id: p3, full_name: "Cora Vale", primary_email: "cora@example.invalid", mobile_number: "+490000000003", whatsapp_number: null, linkedin_url: null, selected_package_code: "europass-european-union", existing_resume_file_id: s3, archived_at: null },
        { id: p4, full_name: "Dara Sample", primary_email: "dara@example.invalid", mobile_number: "+910000000004", whatsapp_number: null, linkedin_url: null, selected_package_code: "executive-transition-agency-distribution", existing_resume_file_id: s4, archived_at: null },
      ],
      file_records: [
        ...[[s2, p2], [s3, p3], [s4, p4]].map(([id, candidate_profile_id]) => ({ id, candidate_profile_id, purpose: "source-resume", status: "available", archived_at: null })),
        { id: f3, candidate_profile_id: p3, purpose: "source-resume", status: "available", access_level: "private", mime_type: "application/pdf", file_extension: "pdf", size_bytes: bytes.length, stored_file_name: `${f3}.pdf`, storage_bucket_name: "candidate-intake-private", storage_object_key: `${p3}/generated/${f3}.pdf`, archived_at: null },
      ],
      profile_resume_reviews: [
        { candidate_profile_id: p3, source_file_id: s3 },
        { candidate_profile_id: p4, source_file_id: s4 },
      ],
      document_records: [
        { id: d3, candidate_profile_id: p3, category: "resume", origin: "generated", status: "available", package_code: "europass-european-union", resume_format_family: "global-ats", cover_letter_type: null, is_privacy_masked: false, file_name_stem: stem, file_record_id: f3, archived_at: null, created_at: "2026-10-01" },
        { id: "66666666-6666-4666-8666-666666666666", candidate_profile_id: p3, category: "resume", origin: "generated", status: "pending", file_record_id: null, archived_at: null },
        { id: "55555555-5555-4555-8555-555555555555", candidate_profile_id: p3, category: "source-resume", origin: "uploaded", status: "available", file_record_id: s3, archived_at: null },
      ],
    },
  };
  state.db = {
    from(table) {
      state.queries.push(table);
      const filters = [];
      let sort = null; let limits = null; let countRequested = false;
      const rows = () => {
        let result = state.records[table].filter((row) => filters.every((filter) => filter(row)));
        if (sort) result = [...result].sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key])) * (sort.asc ? 1 : -1));
        const count = result.length;
        if (limits) result = result.slice(limits[0], limits[1] + 1);
        return { data: result, count: countRequested ? count : null, error: null };
      };
      return {
        select(_columns, options) { countRequested = options?.count === "exact"; return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        not(key, _operator, value) { filters.push((row) => row[key] !== value); return this; },
        is(key, value) { filters.push((row) => row[key] === value); return this; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
        order(key, options) { sort = { key, asc: options?.ascending !== false }; return this; },
        range(from, to) { limits = [from, to]; return this; },
        maybeSingle() { return Promise.resolve({ data: rows().data[0] ?? null, error: null }); },
        then(resolve, reject) { return Promise.resolve(rows()).then(resolve, reject); },
      };
    },
    storage: {
      getBucket: async () => ({ data: { public: state.publicBucket }, error: null }),
      from: () => ({ download: async (path) => { state.downloaded.push(path); return { data: new Blob([bytes]), error: null }; } }),
    },
  };
  globalThis.__adminQa = {
    db: state.db,
    authorize: (role) => { assert.equal(role, "admin"); if (state.denied) throw new Error("ACCESS_DENIED"); },
    client: (userId) => state.records.user_roles.some((role) => role.user_id === userId)
      ? { candidateProfileId: state.records.user_roles.find((role) => role.user_id === userId).candidate_profile_id } : null,
  };
  return state;
}

const filters = (input = {}) => parseAdminDirectoryFilters(input);

test("admin overview uses actual provisioned, uploaded and current-review records", async () => {
  setup();
  const data = await getAdminDirectoryData(filters());
  assert.deepEqual(data.metrics, { clients: 4, sourceResumes: 3, awaitingReview: 1, reviewed: 2, generatedOnPage: 1 });
  assert.deepEqual(data.rows.map((row) => row.resumeStatus), ["needs-resume", "under-review", "reviewed", "reviewed"]);
  assert.equal(data.rows[2].generatedFileCount, 1);
  assert.equal(data.rows[0].generatedFileCount, 0);
});

test("directory shows canonical package, contact fields and safe unknown labels", async () => {
  const state = setup();
  const data = await getAdminDirectoryData(filters());
  assert.equal(data.rows[1].packageName, "GCC / Middle East");
  assert.equal(data.rows[1].email, "bela@example.invalid");
  assert.equal(data.rows[1].mobileNumber, "+971000000002");
  assert.equal(data.rows[1].whatsappNumber, "+971000000022");
  assert.equal(packageNameForDirectory(null), "Not assigned");
  assert.equal(packageNameForDirectory("invented"), "Unknown package");
  state.records.candidate_profiles[0].selected_package_code = null;
  assert.equal((await getAdminDirectoryData(filters())).rows[0].packageName, "Not assigned");
});

test("search by name, email, mobile, WhatsApp and LinkedIn is case-insensitive and server-side", async () => {
  setup();
  for (const query of ["  bELa  ", "BELA@EXAMPLE.INVALID", "+971000000002", "+971000000022", "linkedin.com/in/BELA-FICTION"]) {
    const data = await getAdminDirectoryData(filters({ q: query }));
    assert.deepEqual(data.rows.map((row) => row.fullName), ["Bela Fiction"]);
  }
});

test("package and current review filters combine with search; no-results is honest", async () => {
  setup();
  assert.deepEqual((await getAdminDirectoryData(filters({ package: "gcc-middle-east" }))).rows.map((row) => row.fullName), ["Bela Fiction"]);
  assert.deepEqual((await getAdminDirectoryData(filters({ status: "reviewed" }))).rows.map((row) => row.fullName), ["Cora Vale", "Dara Sample"]);
  assert.deepEqual((await getAdminDirectoryData(filters({ q: "cora", status: "reviewed", package: "europass-european-union" }))).rows.map((row) => row.fullName), ["Cora Vale"]);
  assert.equal((await getAdminDirectoryData(filters({ q: "cora", status: "needs-resume" }))).totalMatching, 0);
  assert.equal((await getAdminDirectoryData(filters({ package: "invalid-package" }))).totalMatching, 0);
});

test("replacement review is not mistaken for confirmation of the current file", async () => {
  const state = setup();
  state.records.profile_resume_reviews[0].source_file_id = s2;
  assert.equal((await getAdminDirectoryData(filters({ q: "Cora" }))).rows[0].resumeStatus, "under-review");
  assert.equal(getAdminResumeStatus(null, false, false), "needs-resume");
});

test("pagination has a fixed size and retains search/filter query state", () => {
  const row = { fullName: "Example", email: "x@example.invalid", mobileNumber: "+1000", whatsappNumber: null, linkedinUrl: null, packageCode: "indian-domestic", resumeStatus: "reviewed" };
  assert.equal(filterAdminDirectory(Array.from({ length: 30 }, () => row), filters({ status: "reviewed" })).length, 30);
  assert.equal(directoryHref("/admin/clients", filters({ q: " Cora ", package: "europass-european-union", status: "reviewed" }), 2),
    "/admin/clients?q=Cora&package=europass-european-union&status=reviewed&page=2");
  assert.equal(filters({ page: "not-a-number" }).page, 1);
});

test("directory pages 25 clients and clamps an out-of-range page", async () => {
  const state = setup();
  for (let index = 0; index < 26; index++) {
    const profileId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const userId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    state.records.user_roles.push({ user_id: userId, candidate_profile_id: profileId, account_status: "active", role_code: "client" });
    state.records.candidate_profiles.push({ id: profileId, full_name: `Extra ${String(index).padStart(2, "0")}`,
      primary_email: `extra${index}@example.invalid`, mobile_number: `+100000${index}`, whatsapp_number: null,
      linkedin_url: null, selected_package_code: "indian-domestic", existing_resume_file_id: null, archived_at: null });
  }
  const second = await getAdminDirectoryData(filters({ page: "2" }));
  assert.equal(second.metrics.clients, 30);
  assert.equal(second.rows.length, 5);
  assert.equal(second.pageCount, 2);
  assert.equal(second.currentPage, 2);
  const clamped = await getAdminDirectoryData(filters({ page: "999" }));
  assert.equal(clamped.currentPage, 2);
  assert.equal(clamped.rows.length, 5);
});

test("only stored generated PDFs with matching private file metadata are counted", async () => {
  const state = setup();
  assert.equal((await getAdminStoredDocuments(p3)).length, 1);
  state.records.file_records[3].storage_object_key = `${p1}/generated/${f3}.pdf`;
  assert.equal((await getAdminStoredDocuments(p3)).length, 0);
  assert.equal((await getAdminDirectoryData(filters({ q: "Cora" }))).rows[0].generatedFileCount, 0);
});

test("signed-out and client-role callers cannot query directory or stored files", async () => {
  const state = setup();
  state.denied = true;
  await assert.rejects(getAdminDirectoryData(filters()), /ACCESS_DENIED/u);
  await assert.rejects(getAdminStoredDocuments(p3), /ACCESS_DENIED/u);
  await assert.rejects(downloadAdminStoredDocument(u3, d3), /ACCESS_DENIED/u);
  assert.deepEqual(state.queries, []);
});

test("admin download requires the selected client's own document and private bucket", async () => {
  const state = setup();
  const response = await GET(new Request("http://localhost/admin/x"), { params: Promise.resolve({ userId: u3, documentId: d3 }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.deepEqual(state.downloaded, [`${p3}/generated/${f3}.pdf`]);
  state.downloaded = [];
  assert.equal(await downloadAdminStoredDocument(u2, d3), null);
  assert.equal(await downloadAdminStoredDocument(u3, p1), null);
  assert.equal(await downloadAdminStoredDocument("../", d3), null);
  state.publicBucket = true;
  assert.equal(await downloadAdminStoredDocument(u3, d3), null);
  assert.deepEqual(state.downloaded, []);
});

test("directory and detail links distinguish Open, Review, stored Download and generator", () => {
  const directory = readFileSync(new URL("../src/features/admin-portal/admin-directory-workspace.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../src/app/admin/clients/[userId]/documents/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.ok(directory.includes('/edit`}>Open'));
  assert.ok(directory.includes('/resume-review`}>Review'));
  assert.ok(directory.includes('/documents`}>Documents'));
  assert.match(detail, /Download stored PDF/u);
  assert.match(detail, /Open an on-demand generator/u);
  assert.match(css, /admin-directory-table-container.*max-width: 100%/u);
  assert.match(css, /overflow-x: auto/u);
  assert.match(css, /admin-directory-filters \{ display: grid/u);
  assert.match(css, /@media \(max-width: 63\.99rem\) \{[\s\S]*admin-directory-table-container \.data-table__cell:last-child/u);
});
