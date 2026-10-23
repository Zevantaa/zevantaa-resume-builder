import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: "data:text/javascript,export async function loadAdminCandidateProfile(userId){if(globalThis.__maskAccess!=='admin')throw Error('ACCESS_DENIED');return userId===globalThis.__maskUserId?globalThis.__maskProfile:null}",
    shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/persistent-document-service") return {
    url: "data:text/javascript,export async function generateAndPersistAdminDocument(profileId,output){return globalThis.__doc13RouteMock(profileId,output)}", shortCircuit: true,
  };
  if (specifier.startsWith("@/features/document-generation/")) {
    const relative = specifier.slice("@/features/document-generation/".length);
    return nextResolve(new URL(`../src/features/document-generation/${relative}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") &&
      !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildGlobalAtsResumeModel } = await import("../src/features/document-generation/global-ats-resume.ts");
const { buildPrivacyMaskedEmployerResume, createCandidateReferenceId, PrivacyMaskReviewRequiredError } = await import("../src/features/document-generation/privacy-masked-resume.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { POST } = await import("../src/app/admin/clients/[userId]/global-ats/privacy-masked/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { mockPersistedRoutePdf } = await import("./doc13-route-mock.mjs");
globalThis.__doc13RouteMock = async (_id, output) => mockPersistedRoutePdf(globalThis.__maskProfile, output);

const userId = "88888888-8888-4888-8888-888888888888";
const profile = () => createLongGlobalAtsQaProfile();
const request = (origin = "http://localhost:3000", body) => new Request(
  `http://localhost:3000/admin/clients/${userId}/global-ats/privacy-masked/download`,
  { method: "POST", headers: { origin }, body },
);
const context = (id = userId) => ({ params: Promise.resolve({ userId: id }) });

async function inspect(buffer) {
  assert.equal(Buffer.from(buffer).subarray(0, 5).toString(), "%PDF-");
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str.trim());
      for (const item of items) {
        const x = item.transform[4];
        const y = item.transform[5];
        assert.ok(x >= 15 && x + item.width <= page.view[2] - 15, `Horizontal clipping on page ${index}`);
        assert.ok(y >= 15 && y <= page.view[3] - 15, `Vertical clipping on page ${index}`);
      }
      for (let first = 0; first < items.length; first++) {
        for (let second = first + 1; second < items.length; second++) {
          const a = items[first]; const b = items[second];
          if (Math.abs(a.transform[5] - b.transform[5]) >= 1.5) continue;
          const overlap = Math.min(a.transform[4] + a.width, b.transform[4] + b.width) - Math.max(a.transform[4], b.transform[4]);
          assert.ok(overlap < 2, `Overlapping text on page ${index}: ${a.str} / ${b.str}`);
        }
      }
      pages.push(items.map((item) => item.str).join(" "));
    }
    return pages;
  } finally { await task.destroy(); }
}

test("reference is stable, public-safe, non-sequential, and distinct across fictional profiles", () => {
  const sample = profile();
  const reference = createCandidateReferenceId(sample.id);
  assert.match(reference, /^ZV-CAN-[0-9A-F]{20}$/);
  assert.equal(reference, createCandidateReferenceId(sample.id.toUpperCase()));
  assert.ok(!reference.includes(sample.id) && !reference.includes(sample.primaryEmail));
  assert.throws(() => createCandidateReferenceId("not-a-uuid"), RangeError);
  const observed = new Set(Array.from({ length: 1000 }, (_, index) => createCandidateReferenceId(
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  )));
  assert.equal(observed.size, 1000);
});

test("normal, masked, normal sequence retains original contact and source state", () => {
  const source = profile();
  const before = structuredClone(source);
  const mapping = mapCandidateProfileToDocumentData(source, "resume");
  const mappingBefore = structuredClone(mapping);
  const normalFirst = buildGlobalAtsResumeModel(mapping);
  const { model: masked, referenceId } = buildPrivacyMaskedEmployerResume(mapping);
  const normalSecond = buildGlobalAtsResumeModel(mapping);
  assert.deepEqual(normalFirst, normalSecond);
  assert.deepEqual(source, before);
  assert.deepEqual(mapping, mappingBefore);
  for (const value of [source.primaryEmail, source.mobileNumber, source.whatsappNumber]) {
    assert.ok(JSON.stringify(normalFirst).includes(value));
    assert.ok(!JSON.stringify(masked).includes(value));
  }
  assert.ok(normalFirst.sections[0].blocks.some((block) => block.kind === "paragraph" && block.text.startsWith("https://www.linkedin.com")));
  assert.ok(!JSON.stringify(masked).includes("linkedin.com"));
  assert.ok(JSON.stringify(masked).includes(referenceId));
  assert.ok(JSON.stringify(masked).includes(source.currentLocation));
  assert.deepEqual(masked.sections.map((section) => section.title), normalFirst.sections.map((section) => section.title));
  assert.equal(masked.header, undefined);
  assert.equal(masked.footer, undefined);
});

test("known direct contact repeated in career text fails closed, including formatted phones", () => {
  for (const leaked of [
    "rohan.kapoor.qa@example.invalid",
    "tel:+91-90000-00000",
    "90000 00001",
    "www.linkedin.com/in/fictional-rohan-kapoor-operations-supply-chain-regional-distribution-quality-planning",
    "different.personal@example.invalid",
    "https://www.linkedin.com/in/another-private-contact",
  ]) {
    const source = profile();
    source.professionalSummary += ` Contact: ${leaked}`;
    assert.throws(() => buildPrivacyMaskedEmployerResume(mapCandidateProfileToDocumentData(source, "resume")), PrivacyMaskReviewRequiredError);
  }
});

test("single-page PDF masks all direct routes but preserves candidate career content", async () => {
  const source = profile();
  source.fullName = "Rohan Kapoor";
  source.professionalSummary = "Fictional operations planning and reporting professional.";
  source.workExperience = source.workExperience.slice(0, 1).map((item) => ({ ...item, highlights: ["Coordinated fictional inventory reporting."] }));
  source.education = source.education.slice(0, 1);
  source.skills = source.skills.slice(0, 3);
  source.certifications = [];
  source.projects = [];
  source.languages = [];
  source.additionalSections = [];
  const mapping = mapCandidateProfileToDocumentData(source, "resume");
  const normal = (await inspect(await renderPdfDocument(buildGlobalAtsResumeModel(mapping)))).join(" ");
  const { model, referenceId } = buildPrivacyMaskedEmployerResume(mapping);
  const pages = await inspect(await renderPdfDocument(model));
  assert.equal(pages.length, 1);
  const masked = pages.join(" ");
  const compact = masked.replace(/\s+/g, "");
  assert.ok(normal.includes(source.primaryEmail));
  assert.ok(normal.includes(source.mobileNumber));
  assert.ok(normal.includes(source.whatsappNumber));
  assert.ok(normal.replace(/\s+/g, "").includes(source.linkedinUrl));
  assert.ok(!masked.includes(source.primaryEmail));
  assert.ok(!masked.includes(source.mobileNumber));
  assert.ok(!masked.includes(source.whatsappNumber));
  assert.ok(!compact.includes(source.linkedinUrl));
  for (const retained of [source.fullName, source.currentLocation, source.workExperience[0].jobTitle,
    source.education[0].qualification, source.skills[0].name, referenceId, "Zevantaa Careers", "route communication through Zevantaa Careers"]) {
    assert.ok(compact.includes(retained.replace(/\s+/g, "")), retained);
  }
});

test("multi-page employer PDF keeps structured content and selectable text", async () => {
  const source = profile();
  const { model, referenceId } = buildPrivacyMaskedEmployerResume(mapCandidateProfileToDocumentData(source, "resume"));
  const pages = await inspect(await renderPdfDocument(model));
  assert.ok(pages.length >= 3, `Expected 3+ pages, got ${pages.length}`);
  const text = pages.join(" ");
  const compact = text.replace(/\s+/g, "");
  for (const retained of [source.fullName, source.currentLocation, "Professional Summary", "Professional Experience",
    "Education", "Skills", "Certifications", "Projects", "Languages", "Additional Information", referenceId]) {
    assert.ok(compact.includes(retained.replace(/\s+/g, "")), retained);
  }
  for (const removed of [source.primaryEmail, source.mobileNumber, source.whatsappNumber]) assert.ok(!text.includes(removed));
  assert.ok(!text.replace(/\s+/g, "").includes(source.linkedinUrl));
});

test("masked PDF metadata and annotations do not expose direct candidate contacts", async () => {
  const source = profile();
  const { model } = buildPrivacyMaskedEmployerResume(mapCandidateProfileToDocumentData(source, "resume"));
  const bytes = await renderPdfDocument(model);
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    const metadata = await pdf.getMetadata();
    const metadataText = JSON.stringify(metadata.info);
    const links = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      links.push(...(await (await pdf.getPage(pageNumber)).getAnnotations()).map((item) => item.url ?? ""));
    }
    const exposed = `${metadataText} ${links.join(" ")}`.replace(/\s+/g, "");
    for (const contact of [source.primaryEmail, source.mobileNumber, source.whatsappNumber, source.linkedinUrl]) {
      assert.ok(!exposed.includes(contact.replace(/\s+/g, "")), contact);
    }
    assert.equal(model.header, undefined);
    assert.equal(model.footer, undefined);
  } finally { await task.destroy(); }
});

test("protected route reloads linked profile, ignores posted facts, and returns private reference filename", async () => {
  globalThis.__maskAccess = "admin";
  globalThis.__maskUserId = userId;
  globalThis.__maskProfile = profile();
  const response = await POST(request("http://localhost:3000", new URLSearchParams({
    fullName: "FORGED", primaryEmail: "attacker@example.invalid", candidateProfileId: "forged",
  })), context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  const filename = response.headers.get("content-disposition");
  assert.match(filename, /ZV_CAN_[0-9A-F]{20}_Global_ATS_Resume_Masked\.pdf/);
  assert.ok(!filename.includes(globalThis.__maskProfile.fullName));
  assert.ok(!filename.includes(globalThis.__maskProfile.primaryEmail));
  const text = (await inspect(await response.arrayBuffer())).join(" ");
  assert.ok(text.replace(/\s+/g, "").includes(globalThis.__maskProfile.fullName.replace(/\s+/g, "")));
  assert.ok(!text.includes("FORGED") && !text.includes("attacker@example.invalid"));
  assert.ok(!text.includes(globalThis.__maskProfile.primaryEmail));
  const missing = await POST(request(), context("99999999-9999-4999-8999-999999999999"));
  assert.equal(missing.status, 404);
  const crossOrigin = await POST(request("https://attacker.invalid"), context());
  assert.equal(crossOrigin.status, 403);
});

test("client and signed-out callers cannot invoke employer export", async () => {
  globalThis.__maskUserId = userId;
  globalThis.__maskProfile = profile();
  for (const access of ["client", "signed-out"]) {
    globalThis.__maskAccess = access;
    await assert.rejects(POST(request(), context()), /ACCESS_DENIED/);
  }
});

test("export route has no public storage dependency or browser-supplied profile payload", () => {
  const source = readFileSync(new URL("../src/app/admin/clients/[userId]/global-ats/privacy-masked/download/route.ts", import.meta.url), "utf8");
  assert.match(source, /loadAdminCandidateProfile\(userId\)/);
  assert.doesNotMatch(source, /request\.formData|request\.json|\.storage\.|getPublicUrl|NEXT_PUBLIC_.*SECRET/);
});
