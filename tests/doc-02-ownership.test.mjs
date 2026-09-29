import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { legacyDocFixture } from "./fixtures/extraction-fixtures.mjs";

const mockModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      "server-only": "export {}",
      "@/features/client-portal/contact-profile-service": "export async function resolveLinkedClientProfile(){return globalThis.__extractionQa.resolve()}",
      "@/lib/supabase/admin": "export function createSupabaseAdminClient(){return globalThis.__extractionQa.admin()}",
    };
    if (specifier in mocks) return { url: mockModule(mocks[specifier]), shortCircuit: true };
    if (specifier === "@/features/client-portal/intake-file-validation") {
      return nextResolve(new URL("../src/features/client-portal/intake-file-validation.ts", import.meta.url).href, context);
    }
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { extractCurrentClientSourceResume } = await import("../src/features/document-generation/current-client-resume-service.ts");
const profileId = "11111111-1111-4111-8111-111111111111";
const otherProfileId = "22222222-2222-4222-8222-222222222222";
const fileId = "33333333-3333-4333-8333-333333333333";
const bytes = legacyDocFixture();

function fixture({ linked = { profileId, userId: "client-user" }, fileOwner = profileId,
  key = `${profileId}/source-resume/${fileId}.doc`, publicBucket = false, mimeType = "application/msword" } = {}) {
  const calls = [];
  const file = {
    id: fileId, candidate_profile_id: fileOwner, purpose: "source-resume",
    status: "available", access_level: "private", mime_type: mimeType,
    file_extension: "doc", size_bytes: bytes.length,
    stored_file_name: `${fileId}.doc`, storage_bucket_name: "candidate-intake-private",
    storage_object_key: key,
  };
  const client = {
    from(table) {
      const filters = {};
      const query = {
        select() { return query; },
        eq(column, value) { filters[column] = value; return query; },
        is() { return query; },
        async maybeSingle() {
          calls.push({ table, filters: { ...filters } });
          if (table === "candidate_profiles") {
            return filters.id === profileId ? { data: { existing_resume_file_id: fileId }, error: null } : { data: null, error: null };
          }
          return filters.id === fileId && filters.candidate_profile_id === fileOwner && fileOwner === profileId ?
            { data: file, error: null } : { data: null, error: null };
        },
      };
      return query;
    },
    storage: {
      async getBucket(id) { calls.push({ bucket: id }); return { data: { public: publicBucket }, error: null }; },
      from(id) {
        calls.push({ storageFrom: id });
        return {
          async download(path) { calls.push({ download: path }); return { data: new Blob([bytes]), error: null }; },
          getPublicUrl() { throw new Error("Public URLs must never be used."); },
        };
      },
    },
  };
  globalThis.__extractionQa = {
    resolve: async () => linked,
    admin: () => { calls.push({ admin: true }); return client; },
  };
  return calls;
}

test("only the authenticated client's linked current source resume is downloaded privately", async () => {
  const calls = fixture();
  const result = await extractCurrentClientSourceResume();
  assert.equal(result.status, "success");
  assert.equal(result.sourceFileId, fileId);
  assert.deepEqual(calls.find((call) => call.download), { download: `${profileId}/source-resume/${fileId}.doc` });
  assert.equal(calls.find((call) => call.table === "file_records").filters.candidate_profile_id, profileId);
  assert.ok(calls.some((call) => call.bucket === "candidate-intake-private"));
  assert.equal(calls.some((call) => call.publicUrl), false);
});

test("unauthenticated or unlinked client triggers no privileged storage access", async () => {
  const calls = fixture({ linked: null });
  const result = await extractCurrentClientSourceResume();
  assert.equal(result.failureReason, "source-unavailable");
  assert.deepEqual(calls, []);
});

test("another candidate's file cannot be selected or downloaded", async () => {
  const calls = fixture({ fileOwner: otherProfileId });
  const result = await extractCurrentClientSourceResume();
  assert.equal(result.failureReason, "source-unavailable");
  assert.equal(calls.some((call) => call.download), false);
});

test("tampered object key and public bucket both fail closed", async () => {
  const pathCalls = fixture({ key: "../../other-profile/source-resume/stolen.doc" });
  assert.equal((await extractCurrentClientSourceResume()).failureReason, "unsafe-storage-reference");
  assert.equal(pathCalls.some((call) => call.download), false);
  const publicCalls = fixture({ publicBucket: true });
  assert.equal((await extractCurrentClientSourceResume()).failureReason, "unsafe-storage-reference");
  assert.equal(publicCalls.some((call) => call.download), false);
});

test("forged browser path argument is ignored; recorded path is authoritative", async () => {
  const calls = fixture();
  // JavaScript callers may pass extra arguments, but the service accepts none.
  await extractCurrentClientSourceResume({ profileId: otherProfileId, key: "public/forged.doc" });
  assert.deepEqual(calls.find((call) => call.download), { download: `${profileId}/source-resume/${fileId}.doc` });
});

test("unsupported recorded MIME is a structured extraction outcome", async () => {
  fixture({ mimeType: "text/plain" });
  const result = await extractCurrentClientSourceResume();
  assert.equal(result.status, "unsupported");
  assert.equal(result.failureReason, "unsupported-format");
});
