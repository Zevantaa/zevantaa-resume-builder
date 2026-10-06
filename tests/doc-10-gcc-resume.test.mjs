import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: "data:text/javascript,export async function requireApplicationRole(role){if(globalThis.__gccQaRole!==role)throw Error('ACCESS_DENIED')}", shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: "data:text/javascript,export async function loadAdminCandidateProfile(userId){if(globalThis.__gccQaRole!=='admin')throw Error('ACCESS_DENIED');globalThis.__gccLoadedUserId=userId;return globalThis.__gccQaProfile}", shortCircuit: true,
  };
  if (specifier === "@/lib/supabase/admin") return {
    url: "data:text/javascript,export function createSupabaseAdminClient(){return globalThis.__gccQaDb}", shortCircuit: true,
  };
  if (specifier.startsWith("@/features/document-generation/")) {
    return nextResolve(new URL(`../src/features/document-generation/${specifier.slice("@/features/document-generation/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/features/client-portal/")) {
    return nextResolve(new URL(`../src/features/client-portal/${specifier.slice("@/features/client-portal/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { createGccQaProfile, createGccQaPhoto } = await import("../src/features/document-generation/gcc-qa-fixture.ts");
const { prepareGccPhotoBytes, loadAdminGccPhoto } = await import("../src/features/document-generation/gcc-photo-service.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildGccResumeModel, isGccPackageEligible, GccResumeNotReadyError } = await import("../src/features/document-generation/gcc-resume.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { POST: productionDownload } = await import("../src/app/admin/clients/[userId]/gcc-resume/download/route.ts");
const { POST: qaDownload } = await import("../src/app/admin/pdf-render-test/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { default: sharp } = await import("sharp");
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

async function inspect(buffer) {
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str.trim());
      pages.push({ width: page.view[2], height: page.view[3], items, text: items.map((item) => item.str).join(" ") });
    }
    return pages;
  } finally { await task.destroy(); }
}
function minimal() {
  const profile = createGccQaProfile();
  profile.professionalSummary = undefined;
  profile.workExperience = []; profile.education = []; profile.skills = profile.skills.slice(0, 1);
  profile.certifications = []; profile.projects = []; profile.languages = []; profile.additionalSections = [];
  profile.whatsappNumber = undefined; profile.linkedinUrl = undefined; profile.currentLocation = "";
  profile.relocationPreference = "not-specified";
  return profile;
}
const mapping = (profile) => mapCandidateProfileToDocumentData(profile, "resume");
const photoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("GCC entitlement comes from the frozen package catalog", () => {
  const allowed = ["gcc-middle-east", "domestic-gcc", "global-mobility-master", "executive-transition-agency-distribution"];
  const denied = ["indian-domestic", "europass-european-union", "domestic-europass-european-union"];
  for (const code of allowed) {
    const profile = createGccQaProfile(); profile.selectedPackage = code;
    assert.equal(isGccPackageEligible(mapping(profile).data), true, code);
    assert.ok(buildGccResumeModel(mapping(profile)).model.sections.length);
  }
  for (const code of denied) {
    const profile = createGccQaProfile(); profile.selectedPackage = code;
    assert.equal(isGccPackageEligible(mapping(profile).data), false, code);
    assert.throws(() => buildGccResumeModel(mapping(profile)), GccResumeNotReadyError);
  }
  const invalid = createGccQaProfile(); invalid.selectedPackage = "unknown-package";
  assert.throws(() => buildGccResumeModel(mapping(invalid)), GccResumeNotReadyError);
});

test("minimal no-photo GCC PDF is one page with no optional placeholders", async (t) => {
  const output = buildGccResumeModel(mapping(minimal()));
  const identity = output.model.sections[0].blocks[0];
  assert.equal(identity.kind, "gcc-identity");
  assert.equal(identity.photoDataUri, undefined);
  assert.deepEqual(output.model.sections.map((section) => section.id), ["identity", "skills"]);
  const pages = await inspect(await renderPdfDocument(output.model, output.theme));
  t.diagnostic(`GCC minimal without photo: ${pages.length} A4 pages`);
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /Verified fictional operations skill 1/);
  assert.doesNotMatch(pages[0].text, /Professional Summary|Certifications|Projects|Languages|N\/A|undefined|WhatsApp|Relocation preference/);
});

test("normal photo/no-photo GCC PDFs reflow and preserve supplied facts", async (t) => {
  const profile = createGccQaProfile();
  const source = await createGccQaPhoto();
  const photo = await prepareGccPhotoBytes(source, "image/png", "png");
  assert.ok(photo);
  const metadata = await sharp(photo).metadata();
  assert.deepEqual([metadata.width, metadata.height], [240, 300]);
  const dataUri = `data:image/png;base64,${Buffer.from(photo).toString("base64")}`;
  const withPhoto = buildGccResumeModel(mapping(profile), dataUri);
  const withoutPhoto = buildGccResumeModel(mapping(profile));
  assert.equal(withPhoto.model.sections[0].blocks[0].photoDataUri, dataUri);
  assert.equal(withoutPhoto.model.sections[0].blocks[0].photoDataUri, undefined);
  const withBuffer = await renderPdfDocument(withPhoto.model, withPhoto.theme);
  const withoutBuffer = await renderPdfDocument(withoutPhoto.model, withoutPhoto.theme);
  assert.match(withBuffer.toString("latin1"), /\/Subtype\s*\/Image/);
  assert.doesNotMatch(withoutBuffer.toString("latin1"), /\/Subtype\s*\/Image/);
  const withPages = await inspect(withBuffer);
  const withoutPages = await inspect(withoutBuffer);
  t.diagnostic(`GCC normal with photo: ${withPages.length} pages; without photo: ${withoutPages.length} pages`);
  for (const pages of [withPages, withoutPages]) {
    const text = pages.map((page) => page.text).join(" ");
    for (const phrase of ["Rohan Kapoor Fictional", "Current location:", "Relocation preference: Open",
      "rohan.kapoor.qa@example.invalid", "WhatsApp:", "Professional Summary", "Professional Experience",
      "Education", "Skills", "Certifications", "Projects", "Languages", "Additional Information",
      "Role 1, supplied bullet 1", "CGPA 8.1/10", "Issued: 2021", "Hindi (professional working)"]) {
      assert.ok(text.includes(phrase), `Missing ${phrase}`);
    }
    assert.ok(text.indexOf("Role 1, supplied bullet 1") < text.indexOf("Role 2, supplied bullet 1"));
    assert.doesNotMatch(text, /N\/A|undefined|Jan 2021|visa status|nationality|passport/i);
  }
});

test("JPEG, PNG and WebP sources decode to the same portrait crop; corrupt images are omitted", async () => {
  const original = await createGccQaPhoto();
  for (const [extension, mimeType] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    const source = extension === "jpg" ? await sharp(original).jpeg().toBuffer()
      : extension === "webp" ? await sharp(original).webp().toBuffer() : Buffer.from(original);
    const output = await prepareGccPhotoBytes(source, mimeType, extension);
    assert.ok(output, `${extension} should decode`);
    const metadata = await sharp(output).metadata();
    assert.deepEqual([metadata.width, metadata.height, metadata.format], [240, 300, "png"]);
  }
  assert.equal(await prepareGccPhotoBytes(original, "image/jpeg", "jpg"), null);
  assert.equal(await prepareGccPhotoBytes(new Uint8Array([1, 2, 3]), "image/png", "png"), null);
});

test("long GCC PDF flows through 3+ pages without missing sections or clipping", async (t) => {
  const profile = createGccQaProfile(true);
  const output = buildGccResumeModel(mapping(profile));
  const pages = await inspect(await renderPdfDocument(output.model, output.theme));
  t.diagnostic(`GCC long-content stress: ${pages.length} A4 pages`);
  assert.ok(pages.length >= 3);
  const longPhoto = await prepareGccPhotoBytes(await createGccQaPhoto(), "image/png", "png");
  assert.ok(longPhoto);
  const withPhoto = buildGccResumeModel(mapping(profile), `data:image/png;base64,${Buffer.from(longPhoto).toString("base64")}`);
  const photoPages = await inspect(await renderPdfDocument(withPhoto.model, withPhoto.theme));
  t.diagnostic(`GCC long-content stress with photo: ${photoPages.length} A4 pages`);
  assert.ok(photoPages.length >= 3);
  const text = pages.map((page) => page.text).join(" ");
  for (const phrase of ["Role 1, supplied bullet 1", "Role 6, supplied bullet 4",
    "Verified fictional operations skill 24", "Issued: May 2020", "Fictional Regional Reporting Project",
    "Additional Information", "Volunteer-supplied bullet"]) assert.ok(text.includes(phrase), phrase);
  assert.ok(text.replace(/\s+/gu, "").includes(profile.linkedinUrl));
  assert.ok(text.indexOf("Role 1, supplied bullet 1") < text.indexOf("Role 6, supplied bullet 4"));
  for (const [variant, checkedPages] of [["without photo", pages], ["with photo", photoPages]]) for (const [pageIndex, page] of checkedPages.entries()) {
    assert.ok(Math.abs(page.width - 595.28) < 1 && Math.abs(page.height - 841.89) < 1);
    for (const item of page.items) {
      const x = item.transform[4]; const y = item.transform[5];
      assert.ok(x >= 15 && x + item.width <= page.width - 15, `${variant} page ${pageIndex + 1} horizontal clip: ${item.str}`);
      assert.ok(y >= 15 && y <= page.height - 15, `${variant} page ${pageIndex + 1} vertical clip: ${item.str}`);
    }
    for (let first = 0; first < page.items.length; first++) for (let second = first + 1; second < page.items.length; second++) {
      const a = page.items[first]; const b = page.items[second];
      if (Math.abs(a.transform[5] - b.transform[5]) >= 1.5) continue;
      const overlap = Math.min(a.transform[4] + a.width, b.transform[4] + b.width) - Math.max(a.transform[4], b.transform[4]);
      assert.ok(overlap < 2, `${variant} page ${pageIndex + 1} text overlap: ${a.str} / ${b.str}`);
    }
  }
  const filename = buildPdfFilename({ candidateName: profile.fullName.repeat(5), output: "gcc-resume" });
  assert.match(filename, /_GCC_Resume\.pdf$/);
  assert.doesNotMatch(filename, /[\\/]|00000000-/);
});

function mockDb(profileId, photoBytes, overrides = {}) {
  const file = { id: photoId, candidate_profile_id: profileId, purpose: "gcc-profile-photo",
    original_file_name: "fictional-photo.png", stored_file_name: `${photoId}.png`, mime_type: "image/png",
    file_extension: "png", size_bytes: photoBytes.length, storage_bucket_name: "candidate-intake-private",
    storage_object_key: `${profileId}/gcc-profile-photo/${photoId}.png`, access_level: "private", status: "available",
    uploaded_at: "2026-09-01T00:00:00Z", ...overrides.file };
  return {
    from(table) { const filters = {}; return {
      select() { return this; }, eq(column, value) { filters[column] = value; return this; }, is() { return this; },
      async maybeSingle() {
        if (table === "candidate_profiles") return { data: filters.id === profileId ? { gcc_photo_file_id: photoId } : null, error: null };
        return { data: Object.entries(filters).every(([key, value]) => file[key] === value) ? file : null, error: null };
      },
    }; },
    storage: {
      async getBucket() { return { data: { public: overrides.publicBucket === true }, error: null }; },
      from(bucket) { return { async download(key) {
        globalThis.__gccDownloadedKey = key;
        return bucket === "candidate-intake-private" && key === file.storage_object_key
          ? { data: new Blob([photoBytes]), error: null } : { data: null, error: Error("missing") };
      } }; },
    },
  };
}

test("private photo resolver enforces admin role, owner, exact key and private bucket", async () => {
  const profile = createGccQaProfile();
  const bytes = await createGccQaPhoto();
  globalThis.__gccQaDb = mockDb(profile.id, bytes);
  for (const role of [null, "client"]) {
    globalThis.__gccQaRole = role;
    await assert.rejects(() => loadAdminGccPhoto(profile.id), /ACCESS_DENIED/);
  }
  globalThis.__gccQaRole = "admin";
  const own = await loadAdminGccPhoto(profile.id);
  assert.ok(own?.png);
  assert.equal(own.reference.id, photoId);
  assert.equal(globalThis.__gccDownloadedKey, `${profile.id}/gcc-profile-photo/${photoId}.png`);
  globalThis.__gccDownloadedKey = undefined;
  globalThis.__gccQaDb = mockDb(profile.id, bytes, { publicBucket: true });
  assert.equal(await loadAdminGccPhoto(profile.id), null);
  assert.equal(globalThis.__gccDownloadedKey, undefined);
  globalThis.__gccQaDb = mockDb(profile.id, bytes, { file: { candidate_profile_id: "different-profile" } });
  assert.equal(await loadAdminGccPhoto(profile.id), null);
  globalThis.__gccQaDb = mockDb(profile.id, bytes, { file: { storage_object_key: "other/path.png" } });
  assert.equal(await loadAdminGccPhoto(profile.id), null);
});

test("production route rechecks admin, reloads profile and ignores posted facts/photo paths", async () => {
  const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const url = `http://localhost:3000/admin/clients/${userId}/gcc-resume/download`;
  const request = (origin = "http://localhost:3000") => new Request(url, { method: "POST", headers: { origin },
    body: new URLSearchParams({ candidate_profile_id: "injected", photo_url: "https://elsewhere.invalid/photo.jpg", fullName: "Injected Candidate" }) });
  const context = { params: Promise.resolve({ userId }) };
  globalThis.__gccQaProfile = createGccQaProfile();
  globalThis.__gccQaDb = mockDb(globalThis.__gccQaProfile.id, await createGccQaPhoto());
  for (const role of [null, "client"]) {
    globalThis.__gccQaRole = role;
    await assert.rejects(() => productionDownload(request(), context), /ACCESS_DENIED/);
  }
  globalThis.__gccQaRole = "admin";
  assert.equal((await productionDownload(request("https://elsewhere.invalid"), context)).status, 403);
  const response = await productionDownload(request(), context);
  assert.equal(response.status, 200);
  assert.equal(globalThis.__gccLoadedUserId, userId);
  assert.match(response.headers.get("content-disposition"), /_GCC_Resume\.pdf/);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  const pdf = Buffer.from(await response.arrayBuffer());
  const text = (await inspect(pdf)).map((page) => page.text).join(" ");
  assert.match(text, /Rohan Kapoor Fictional/);
  assert.doesNotMatch(text, /Injected Candidate|injected|elsewhere\.invalid|candidate-intake-private/);
  assert.match(pdf.toString("latin1"), /\/Subtype\s*\/Image/);
  const denied = createGccQaProfile(); denied.selectedPackage = "indian-domestic";
  globalThis.__gccQaProfile = denied;
  assert.equal((await productionDownload(request(), context)).status, 422);
});

test("QA harness offers only fictional GCC scenarios and is admin-only", async (t) => {
  const url = "http://localhost:3000/admin/pdf-render-test/download";
  const request = (scenario) => new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" },
    body: new URLSearchParams({ scenario, fullName: "Injected Candidate", photo_url: "https://elsewhere.invalid" }) });
  for (const role of [null, "client"]) {
    globalThis.__gccQaRole = role;
    await assert.rejects(() => qaDownload(request("gcc-with-photo")), /ACCESS_DENIED/);
  }
  globalThis.__gccQaRole = "admin";
  assert.equal((await qaDownload(request("gcc-unknown"))).status, 400);
  for (const scenario of ["gcc-with-photo", "gcc-without-photo", "gcc-long"]) {
    const response = await qaDownload(request(scenario));
    assert.equal(response.status, 200, scenario);
    assert.match(response.headers.get("content-disposition"), /_GCC_Resume\.pdf/);
    const pdf = Buffer.from(await response.arrayBuffer());
    const pages = await inspect(pdf);
    t.diagnostic(`${scenario}: ${pages.length} A4 pages`);
    if (scenario === "gcc-with-photo") assert.match(pdf.toString("latin1"), /\/Subtype\s*\/Image/);
    if (scenario === "gcc-without-photo") assert.doesNotMatch(pdf.toString("latin1"), /\/Subtype\s*\/Image/);
    if (scenario === "gcc-long") assert.ok(pages.length >= 3);
    assert.doesNotMatch(pages.map((page) => page.text).join(" "), /Injected Candidate|elsewhere\.invalid/);
  }
});

test("server-only source boundaries contain private references and secrets", () => {
  const route = read("src/app/admin/clients/[userId]/gcc-resume/download/route.ts");
  const loader = read("src/features/document-generation/admin-global-ats-service.ts");
  const photo = read("src/features/document-generation/gcc-photo-service.ts");
  const panel = read("src/features/document-generation/pdf/pdf-render-qa-panel.tsx");
  assert.match(loader, /requireApplicationRole\("admin"\)/);
  assert.match(route, /loadAdminCandidateProfile\(userId\)/);
  assert.match(photo, /requireApplicationRole\("admin"\)/);
  assert.match(photo, /bucket\.public/);
  assert.doesNotMatch(route, /request\.json|getPublicUrl|createSignedUrl|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(panel, /SUPABASE_SECRET_KEY|service_role|candidate-intake-private/);
});
