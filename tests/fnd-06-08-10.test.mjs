import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import sharp from "sharp";

const mockModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const modules = {
      "server-only": "export {}",
      "@/lib/supabase/admin": "export function createSupabaseAdminClient(){return globalThis.__intakeQa.admin}",
      "@/features/authentication/authorization": "export async function requireApplicationRole(role){return globalThis.__intakeQa.requireRole(role)}",
      "next/cache": "export function revalidatePath(path){globalThis.__intakeQa.revalidated=path}",
      "next/server": "export function after(callback){globalThis.__intakeQa.after=callback}",
      "@/features/document-generation/resume-processing-service": "export async function processResumeProcessingJobs(){globalThis.__intakeQa.processed=true;return {completed:0,needsInput:0,failed:0}}",
    };
    if (specifier in modules) return { url: mockModule(modules[specifier]), shortCircuit: true };
    if (specifier === "./contact-profile-service" && context.parentURL?.endsWith("client-intake-service.ts")) {
      return { url: mockModule("export async function resolveLinkedClientProfile(){return globalThis.__intakeQa.linked()}"), shortCircuit: true };
    }
    if (specifier === "./client-intake-service" && context.parentURL?.endsWith("save-client-intake-action.ts")) {
      return { url: mockModule("export async function saveClientIntake(values){return globalThis.__intakeQa.save(values)}"), shortCircuit: true };
    }
    if (specifier.startsWith("@/types/")) {
      return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith("@/features/document-generation/")) {
      return nextResolve(new URL(`../src/features/document-generation/${specifier.slice("@/features/document-generation/".length)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { validateIntakeFile, validateIntakeFileMetadata, IntakeFileValidationError } = await import("../src/features/client-portal/intake-file-validation.ts");
const { validateDecodedIntakePhoto } = await import("../src/features/client-portal/decode-intake-photo.ts");
const { saveClientIntake, getClientIntakeFiles } = await import("../src/features/client-portal/client-intake-service.ts");
const { saveClientIntakeAction } = await import("../src/features/client-portal/save-client-intake-action.ts");

const PDF = Uint8Array.from(Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\nstartxref\n9\n%%EOF\n"));
const DOC = Buffer.alloc(512);
Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(DOC);
DOC.writeUInt16LE(0xfffe, 28);
DOC.writeUInt16LE(9, 30);
DOC.writeUInt16LE(6, 32);
Buffer.from("WordDocument", "utf16le").copy(DOC, 100);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const locals = [];
  const directory = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(text);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(Buffer.concat([local, nameBytes, data]));
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(Buffer.concat([central, nameBytes]));
    offset += locals.at(-1).length;
  }
  const directoryBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directoryBytes, end]);
}

const DOCX = storedZip([
  ["[Content_Types].xml", "<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'/>"] ,
  ["word/document.xml", "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'/>"] ,
]);
// One-pixel synthetic images generated for the test suite; no client data.
const JPEG = Buffer.from("/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC2AMQZ/9k=", "base64");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgeFYGAAJGAV2zb/GzAAAAAElFTkSuQmCC", "base64");
const WEBP = Buffer.from("UklGRjgAAABXRUJQVlA4ICwAAACQAQCdASoBAAEAAUAmJaACdLoAA5gA/ufkvr4Ap+z//I4//I4//I4/+QyAAA==", "base64");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const file = (name, type, bytes) => new File([bytes], name, { type });

test("supported PDF, DOC and DOCX samples pass extension/MIME/structure checks", async () => {
  for (const [name, mime, bytes] of [
    ["resume.pdf", "application/pdf", PDF],
    ["resume.doc", "application/msword", DOC],
    ["resume.docx", DOCX_MIME, DOCX],
  ]) {
    const result = await validateIntakeFile(file(name, mime, bytes), "source-resume");
    assert.equal(result.metadata.originalFileName, name);
  }
});

test("resume rejects invalid extension, MIME, content and path segments", async () => {
  for (const candidate of [
    file("resume.exe", "application/pdf", PDF),
    file("resume.pdf", "application/msword", PDF),
    file("../resume.pdf", "application/pdf", PDF),
  ]) assert.throws(() => validateIntakeFileMetadata(candidate, "source-resume"), IntakeFileValidationError);
  await assert.rejects(validateIntakeFile(file("resume.pdf", "application/pdf", DOC), "source-resume"), IntakeFileValidationError);
});

test("resume rejects over 10 MB and empty input", () => {
  assert.throws(() => validateIntakeFileMetadata({ name: "resume.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }, "source-resume"), IntakeFileValidationError);
  assert.throws(() => validateIntakeFileMetadata({ name: "resume.pdf", type: "application/pdf", size: 0 }, "source-resume"), IntakeFileValidationError);
  assert.equal(validateIntakeFileMetadata({ name: "resume.pdf", type: "application/pdf", size: 10 * 1024 * 1024 }, "source-resume").sizeBytes, 10 * 1024 * 1024);
});

test("deceptive double extensions, traversal names, and long filenames are rejected", () => {
  for (const name of ["resume.pdf.exe", "resume.exe.pdf", "resume.pdf.docx", "../resume.pdf", "..\\resume.pdf", `${"a".repeat(256)}.pdf`]) {
    assert.throws(() => validateIntakeFileMetadata({ name, type: "application/pdf", size: PDF.length }, "source-resume"), IntakeFileValidationError, name);
  }
  assert.equal(validateIntakeFileMetadata({ name: "resume.final.pdf", type: "application/pdf", size: PDF.length }, "source-resume").originalFileName, "resume.final.pdf");
});

test("truncated or header-only resume content is rejected", async () => {
  for (const [name, mime, bytes] of [
    ["resume.pdf", "application/pdf", Buffer.from("%PDF-1.7\n")],
    ["resume.doc", "application/msword", DOC.subarray(0, 8)],
    ["resume.docx", DOCX_MIME, Buffer.from("PK\u0003\u0004[Content_Types].xml word/document.xml")],
  ]) await assert.rejects(validateIntakeFile(file(name, mime, bytes), "source-resume"), IntakeFileValidationError, name);
});

test("DOCX upload rejects missing essential OOXML members and malformed ZIP directory", async () => {
  for (const bytes of [
    storedZip([["[Content_Types].xml", "<Types/>"]]),
    storedZip([["word/document.xml", "<w:document/>"]]),
    DOCX.subarray(0, DOCX.length - 3),
  ]) {
    await assert.rejects(validateIntakeFile(file("resume.docx", DOCX_MIME, bytes), "source-resume"), IntakeFileValidationError);
  }
});

test("PDF upload rejects absent or truncated EOF and malformed cross-reference marker", async () => {
  for (const bytes of [
    Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\nstartxref\n9\n"),
    Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\nnotxref\n9\n%%EOF\n"),
    Buffer.from("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\nstartxref\n999999\n%%EOF\n"),
  ]) {
    await assert.rejects(validateIntakeFile(file("resume.pdf", "application/pdf", bytes), "source-resume"), IntakeFileValidationError);
  }
});

test("valid JPEG, PNG and WebP photos pass", async () => {
  for (const [name, mime, bytes] of [
    ["portrait.jpg", "image/jpeg", JPEG],
    ["portrait.png", "image/png", PNG],
    ["portrait.webp", "image/webp", WEBP],
  ]) {
    await assert.doesNotReject(validateIntakeFile(file(name, mime, bytes), "gcc-profile-photo"), name);
  }
});

test("photo with excessive decoded dimensions is rejected even when compressed bytes are small", async () => {
  const wide = await sharp({ create: { width: 4001, height: 1, channels: 3,
    background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  await assert.rejects(validateDecodedIntakePhoto(wide, "png"),
    /could not be decoded safely/);
});

test("photo with excessive decoded pixel count is rejected", async () => {
  const oversizedPixels = await sharp({ create: { width: 4000, height: 4000, channels: 3,
    background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  await assert.rejects(validateDecodedIntakePhoto(oversizedPixels, "png"), /could not be decoded safely/);
});

test("photo rejects invalid type and over 5 MB", async () => {
  assert.throws(() => validateIntakeFileMetadata(file("portrait.gif", "image/gif", JPEG), "gcc-profile-photo"), IntakeFileValidationError);
  assert.throws(() => validateIntakeFileMetadata({ name: "portrait.png", type: "image/png", size: 5 * 1024 * 1024 + 1 }, "gcc-profile-photo"), IntakeFileValidationError);
  await assert.rejects(validateIntakeFile(file("portrait.jpg", "image/jpeg", PNG), "gcc-profile-photo"), IntakeFileValidationError);
  assert.throws(() => validateIntakeFileMetadata(file("portrait.jpg", "image/png", PNG), "gcc-profile-photo"), IntakeFileValidationError);
  assert.equal(validateIntakeFileMetadata({ name: "portrait.webp", type: "image/webp", size: 5 * 1024 * 1024 }, "gcc-profile-photo").sizeBytes, 5 * 1024 * 1024);
});

test("truncated or header-only photo content is rejected", async () => {
  for (const [name, mime, bytes] of [
    ["portrait.jpg", "image/jpeg", JPEG.subarray(0, 20)],
    ["portrait.png", "image/png", PNG.subarray(0, 24)],
    ["portrait.webp", "image/webp", WEBP.subarray(0, 20)],
  ]) await assert.rejects(validateIntakeFile(file(name, mime, bytes), "gcc-profile-photo"), IntakeFileValidationError, name);
  const corruptPng = Buffer.from(PNG);
  corruptPng[corruptPng.length - 20] ^= 1;
  await assert.rejects(validateIntakeFile(file("portrait.png", "image/png", corruptPng), "gcc-profile-photo"), IntakeFileValidationError);
});

test("the Server Action module exports only async functions", () => {
  const source = readFileSync(new URL("../src/features/client-portal/save-client-intake-action.ts", import.meta.url), "utf8");
  assert.match(source, /^"use server";/);
  assert.deepEqual([...source.matchAll(/^export\s+(?!async\s+function\b)\S+/gm)], []);
});

const ownId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const oldResumeId = "44444444-4444-4444-8444-444444444444";
const oldPhotoId = "55555555-5555-4555-8555-555555555555";
function setupService() {
  const rows = new Map([
    [oldResumeId, { id: oldResumeId, candidate_profile_id: ownId, purpose: "source-resume", original_file_name: "old.pdf", mime_type: "application/pdf", status: "available", version_number: 1, content_sha256: null }],
    [oldPhotoId, { id: oldPhotoId, candidate_profile_id: ownId, purpose: "gcc-profile-photo", original_file_name: "old.png", mime_type: "image/png", status: "available", version_number: 1, content_sha256: null }],
  ]);
  const written = [];
  const uploaded = [];
  const profile = {
    id: ownId,
    full_name: "Admin Managed Name",
    primary_email: "admin-managed@example.invalid",
    selected_package_code: "domestic-gcc",
    existing_resume_file_id: oldResumeId,
    gcc_photo_file_id: oldPhotoId,
  };
  const query = (table) => {
    const criteria = {};
    let mode = "read";
    let payload;
    const builder = {
      select() { return builder; },
      eq(key, value) { criteria[key] = value; return builder; },
      is(key, value) { criteria[key] = value; return builder; },
      update(value) { mode = "update"; payload = value; return builder; },
      insert(value) { written.push({ table, value }); rows.set(value.id, value); return Promise.resolve({ error: null }); },
      delete() { mode = "delete"; return builder; },
      async maybeSingle() {
        if (table === "candidate_profiles") {
          if (criteria.id !== ownId) return { data: null, error: null };
          if (mode === "update") {
            Object.assign(profile, payload);
            written.push({ table, value: payload });
          }
          return { data: profile, error: null };
        }
        const row = rows.get(criteria.id);
        return { data: row?.candidate_profile_id === criteria.candidate_profile_id && row?.purpose === criteria.purpose ? row : null, error: null };
      },
      then(resolve) {
        if (mode === "update") {
          Object.assign(rows.get(criteria.id), payload);
          written.push({ table, value: payload });
        }
        if (mode === "delete") rows.delete(criteria.id);
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return builder;
  };
  globalThis.__intakeQa = {
    linked: () => ({ profileId: ownId, userId }),
    admin: {
      from: query,
      storage: { from: () => ({ upload: async (key, bytes, options) => { uploaded.push({ key, bytes, options }); return { error: null }; }, remove: async () => ({ error: null }) }) },
    },
    requireRole: async () => {},
    save: async () => "saved",
  };
  return { written, uploaded, profile, rows };
}

const values = {
  contact: { fullName: "Fiction Example", primaryEmail: "fiction@example.invalid", mobileNumber: "+919999999999", whatsappNumber: null },
  details: { linkedinUrl: null, currentLocation: "Kolkata, India", relocationPreference: "open" },
};

test("replacement links only own profile, increments versions and keeps history", async () => {
  const { written, uploaded, profile, rows } = setupService();
  assert.equal(await saveClientIntake({ ...values, resume: file("new.pdf", "application/pdf", PDF), photo: file("new.png", "image/png", PNG) }), "saved");
  const records = written.filter((item) => item.table === "file_records" && item.value.replaces_file_id);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((item) => item.value.replaces_file_id).sort(), [oldResumeId, oldPhotoId].sort());
  assert.ok(records.every((item) => item.value.version_number === 2 && item.value.candidate_profile_id === ownId && item.value.access_level === "private"));
  const resumeRecord = records.find((item) => item.value.purpose === "source-resume");
  assert.equal(resumeRecord.value.content_sha256, createHash("sha256").update(PDF).digest("hex"));
  assert.equal(records.find((item) => item.value.purpose === "gcc-profile-photo").value.content_sha256, null);
  assert.ok(uploaded.every((item) => item.key.startsWith(`${ownId}/`) && !item.key.includes("new.")));
  assert.notEqual(profile.existing_resume_file_id, oldResumeId);
  assert.notEqual(profile.gcc_photo_file_id, oldPhotoId);
  assert.equal(rows.get(oldResumeId).status, "replaced");
  assert.equal(rows.get(oldPhotoId).status, "replaced");
  assert.deepEqual(await getClientIntakeFiles(), {
    resume: { originalFileName: "new.pdf", mimeType: "application/pdf", status: "available" },
    photo: { originalFileName: "new.png", mimeType: "image/png", status: "available" },
  });
  assert.equal(profile.full_name, "Admin Managed Name");
  assert.equal(profile.primary_email, "admin-managed@example.invalid");
  assert.equal(profile.selected_package_code, "domestic-gcc");
});

test("re-uploading the current resume bytes is idempotent", async () => {
  const { written, uploaded, rows, profile } = setupService();
  rows.get(oldResumeId).content_sha256 = createHash("sha256").update(PDF).digest("hex");
  assert.equal(await saveClientIntake({ resume: file("same.pdf", "application/pdf", PDF), photo: null }), "unchanged");
  assert.deepEqual(written, []);
  assert.deepEqual(uploaded, []);
  assert.equal(profile.existing_resume_file_id, oldResumeId);
});

test("failed private resume replacement preserves prior linkage and version", async () => {
  const { profile, rows } = setupService();
  globalThis.__intakeQa.admin.storage.from = () => ({
    upload: async () => ({ error: new Error("synthetic storage failure") }),
    remove: async () => ({ error: null }),
  });
  await assert.rejects(saveClientIntake({ resume: file("new.pdf", "application/pdf", PDF), photo: null }), /private file upload failed/);
  assert.equal(profile.existing_resume_file_id, oldResumeId);
  assert.equal(rows.get(oldResumeId).status, "available");
});

test("failed private GCC photo replacement preserves prior photo linkage", async () => {
  const { profile, rows } = setupService();
  globalThis.__intakeQa.admin.storage.from = () => ({
    upload: async () => ({ error: new Error("synthetic storage failure") }),
    remove: async () => ({ error: null }),
  });
  await assert.rejects(saveClientIntake({ resume: null, photo: file("new.png", "image/png", PNG) }), /private file upload failed/);
  assert.equal(profile.gcc_photo_file_id, oldPhotoId);
  assert.equal(rows.get(oldPhotoId).status, "available");
});

test("non-GCC package cannot submit a forged photograph upload", async () => {
  const { written, uploaded, profile } = setupService();
  profile.selected_package_code = "indian-domestic";
  await assert.rejects(saveClientIntake({ resume: null, photo: file("new.png", "image/png", PNG) }),
    (error) => error instanceof IntakeFileValidationError && error.field === "photo");
  assert.deepEqual(written, []);
  assert.deepEqual(uploaded, []);
});

test("loading files reveals only display metadata, not storage paths", async () => {
  setupService();
  const files = await getClientIntakeFiles();
  assert.deepEqual(files, { resume: { originalFileName: "old.pdf", mimeType: "application/pdf", status: "available" }, photo: { originalFileName: "old.png", mimeType: "image/png", status: "available" } });
  assert.equal(JSON.stringify(files).includes("candidate-intake-private"), false);
});

test("missing linkage does not read or write another profile", async () => {
  const { written, uploaded } = setupService();
  globalThis.__intakeQa.linked = () => null;
  assert.equal(await saveClientIntake({ ...values, resume: null, photo: null }), "missing");
  assert.equal(await getClientIntakeFiles(), null);
  assert.deepEqual(written, []);
  assert.deepEqual(uploaded, []);
});

test("a different client profile ID cannot be read or changed", async () => {
  const { written, uploaded } = setupService();
  globalThis.__intakeQa.linked = () => ({ profileId: otherId, userId });
  assert.equal(await getClientIntakeFiles(), null);
  assert.equal(await saveClientIntake({ ...values, resume: null, photo: null }), "missing");
  assert.deepEqual(written, []);
  assert.deepEqual(uploaded, []);
});

test("a missing source resume receives a field-level error before any write", async () => {
  const { written, uploaded, profile } = setupService();
  profile.existing_resume_file_id = null;
  await assert.rejects(
    saveClientIntake({ ...values, resume: null, photo: null }),
    (error) => error instanceof IntakeFileValidationError && error.field === "resume",
  );
  assert.deepEqual(written, []);
  assert.deepEqual(uploaded, []);
});

test("first private resume upload links a newly provisioned profile without changing admin fields", async () => {
  const { written, uploaded, profile } = setupService();
  profile.existing_resume_file_id = null;
  assert.equal(await saveClientIntake({ resume: file("first.pdf", "application/pdf", PDF), photo: null }), "saved");
  const row = written.find((item) => item.table === "file_records");
  assert.equal(row.value.version_number, 1);
  assert.equal(row.value.replaces_file_id, null);
  assert.equal(row.value.candidate_profile_id, ownId);
  assert.equal(profile.existing_resume_file_id, row.value.id);
  assert.equal(profile.full_name, "Admin Managed Name");
  assert.equal(profile.selected_package_code, "domestic-gcc");
  assert.equal(uploaded.length, 1);
});

test("a non-available resume record does not satisfy the required upload", async () => {
  const { written, rows } = setupService();
  rows.get(oldResumeId).status = "failed";
  await assert.rejects(
    saveClientIntake({ ...values, resume: null, photo: null }),
    (error) => error instanceof IntakeFileValidationError && error.field === "resume",
  );
  assert.deepEqual(written, []);
});

function validForm() {
  const form = new FormData();
  form.set("photo", file("portrait.png", "image/png", PNG));
  return form;
}

test("server action rejects every administratively locked field", async () => {
  setupService();
  for (const field of [
    "fullName", "primaryEmail", "mobileNumber", "whatsappNumber",
    "linkedinUrl", "currentLocation", "relocationPreference",
    "packageCode", "targetMarkets", "candidateProfileId",
  ]) {
    const form = validForm();
    form.set(field, "tampered");
    const result = await saveClientIntakeAction({ status: "idle" }, form);
    assert.equal(result.status, "error", field);
    assert.match(result.message, /administratively managed/i, field);
  }
});

test("photo-only replacement succeeds without submitting locked profile fields", async () => {
  setupService();
  const form = validForm();
  assert.equal((await saveClientIntakeAction({ status: "idle" }, form)).status, "success");
});

test("server action reports invalid upload metadata by field", async () => {
  setupService();
  const form = validForm();
  form.set("resume", file("resume.exe", "application/pdf", PDF));
  form.set("photo", file("portrait.jpg", "image/png", PNG));
  const result = await saveClientIntakeAction({ status: "idle" }, form);
  assert.equal(result.status, "error");
  assert.equal(typeof result.errors?.resume, "string");
  assert.equal(typeof result.errors?.photo, "string");
});

test("a forged non-file upload value is rejected", async () => {
  setupService();
  const form = validForm();
  form.set("resume", "not-a-file");
  const result = await saveClientIntakeAction({ status: "idle" }, form);
  assert.equal(result.status, "error");
  assert.equal(typeof result.errors?.resume, "string");
});

test("server action maps missing-resume storage validation to the resume field", async () => {
  setupService();
  globalThis.__intakeQa.save = async () => { throw new IntakeFileValidationError("Upload a source resume.", "resume"); };
  const result = await saveClientIntakeAction({ status: "idle" }, validForm());
  assert.equal(result.errors?.resume, "Upload a source resume.");
});

test("non-client callers cannot invoke the intake action", async () => {
  setupService();
  globalThis.__intakeQa.requireRole = async () => { throw new Error("access denied"); };
  await assert.rejects(saveClientIntakeAction({ status: "idle" }, validForm()), /access denied/);
});

test("intake action rejects browser-supplied profile ID and package mutation", async () => {
  setupService();
  const form = validForm();
  form.set("profileId", otherId);
  assert.equal((await saveClientIntakeAction({ status: "idle" }, form)).status, "error");
  form.delete("profileId");
  form.set("packageCode", "gcc-middle-east");
  assert.equal((await saveClientIntakeAction({ status: "idle" }, form)).status, "error");
});

test("intake action requires a file and accepts an upload-only save", async () => {
  setupService();
  const form = new FormData();
  assert.equal((await saveClientIntakeAction({ status: "idle" }, form)).errors.resume !== undefined, true);
  form.set("resume", file("resume.pdf", "application/pdf", PDF));
  assert.equal((await saveClientIntakeAction({ status: "idle" }, form)).status, "success");
  assert.equal(globalThis.__intakeQa.revalidated, "/client/profile");
});
