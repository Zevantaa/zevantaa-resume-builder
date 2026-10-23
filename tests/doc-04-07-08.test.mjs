import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: "data:text/javascript,export async function requireApplicationRole(role){if(globalThis.__atsAccess!==role)throw Error('ACCESS_DENIED')}", shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: "data:text/javascript,export async function loadAdminCandidateProfile(){if(globalThis.__atsAccess!=='admin')throw Error('ACCESS_DENIED');return globalThis.__atsProfile}", shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/persistent-document-service") return {
    url: "data:text/javascript,export async function generateAndPersistAdminDocument(profileId,output){return globalThis.__doc13RouteMock(profileId,output)}", shortCircuit: true,
  };
  if (specifier.startsWith("@/features/document-generation/")) {
    const relative = specifier.replace("@/features/document-generation/", "");
    return nextResolve(new URL(`../src/features/document-generation/${relative}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.split("/").at(-1)}.ts`, import.meta.url).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildGlobalAtsResumeModel } = await import("../src/features/document-generation/global-ats-resume.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { POST: productionDownload } = await import("../src/app/admin/clients/[userId]/global-ats/download/route.ts");
const { POST: qaDownload } = await import("../src/app/admin/pdf-render-test/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { mockPersistedRoutePdf } = await import("./doc13-route-mock.mjs");
globalThis.__doc13RouteMock = async (_id, output) => mockPersistedRoutePdf(globalThis.__atsProfile, output);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function inspect(buffer) {
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const textItems = items.filter((item) => "str" in item && item.str.trim());
      pages.push({ width: page.view[2], height: page.view[3], items: textItems,
        text: textItems.map((item) => item.str).join(" ") });
    }
    return pages;
  } finally { await task.destroy(); }
}

test("long fictional canonical profile covers every section and retains source ordering", () => {
  const profile = createLongGlobalAtsQaProfile();
  assert.ok(profile.fullName.length > 60);
  assert.ok(profile.linkedinUrl.length > 90);
  assert.ok(profile.professionalSummary.length > 600);
  assert.ok(profile.workExperience.length >= 5);
  assert.ok(profile.skills.length >= 20);
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  assert.equal(mapping.canGenerate, true);
  const model = buildGlobalAtsResumeModel(mapping);
  assert.deepEqual(model.sections.map((section) => section.title ?? "Identity"), [
    "Identity", "Professional Summary", "Professional Experience", "Education", "Skills", "Certifications",
    "Projects", "Languages", "Additional Information",
  ]);
  assert.equal(model.header, undefined);
  assert.equal(model.footer, undefined);
  assert.ok(model.sections.every((section) => section.blocks.length && section.blocks.every((block) =>
    block.kind !== "columns" && block.kind !== "contact-row" && block.kind !== "page-break")));
});

test("real Global ATS PDF spans 3+ pages with searchable content and bounded text", async (t) => {
  const profile = createLongGlobalAtsQaProfile();
  const model = buildGlobalAtsResumeModel(mapCandidateProfileToDocumentData(profile, "resume"));
  const pages = await inspect(await renderPdfDocument(model));
  t.diagnostic(`Long Global ATS PDF: ${pages.length} A4 pages`);
  assert.ok(pages.length >= 3, `Expected at least 3 pages, got ${pages.length}`);
  const text = pages.map((page) => page.text).join(" ");
  for (const phrase of [profile.fullName, profile.primaryEmail,
    "Professional Summary", "Professional Experience", "Education", "Skills", "Certifications",
    "Projects", "Languages", "Additional Information", "Fictional Lean Six Sigma Green Belt",
    "Fictional Regional Reporting Project", "CGPA 8.1/10", "Issued: 2021", "Issued: May 2020",
    "Jul 2012", "May 2015", "Present", "Verified fictional operations skill 24",
    "Role 1, supplied bullet 1", "Role 6, supplied bullet 4", "Volunteer-supplied bullet"]) {
    assert.ok(text.includes(phrase), `Missing extracted text: ${phrase}`);
  }
  assert.ok(text.replace(/\s+/gu, "").includes(profile.linkedinUrl), `Wrapped URL retains all selectable characters: ${text.slice(text.indexOf("https"), text.indexOf("https") + 240)}`);
  assert.ok(text.indexOf("Professional Experience") < text.indexOf("Education"));
  assert.ok(text.indexOf("Education") < text.indexOf("Skills"));
  assert.ok(text.indexOf("Skills") < text.indexOf("Certifications"));
  assert.ok(text.indexOf("Role 1, supplied bullet 1") < text.indexOf("Role 6, supplied bullet 4"));
  assert.ok(text.indexOf("Verified fictional operations skill 1") < text.indexOf("Verified fictional operations skill 24"));
  assert.doesNotMatch(text, /undefined|null|Placeholder|Jan 2021|ATS Score|Zevantaa Resume Builder QA/);
  assert.ok((text.match(/•/gu) ?? []).length >= 24, "Expected intact bullet markers in extracted text");
  const spansPages = Array.from({ length: 6 }, (_, index) => {
    const first = pages.findIndex((page) => page.text.includes(`Role ${index + 1}, supplied bullet 1`));
    const last = pages.findIndex((page) => page.text.includes(`Role ${index + 1}, supplied bullet 4`));
    return first >= 0 && last >= 0 && first !== last;
  });
  assert.ok(spansPages.some(Boolean), "At least one long employment entry should continue onto a later page");
  for (const [index, page] of pages.entries()) {
    assert.ok(Math.abs(page.width - 595.28) < 1 && Math.abs(page.height - 841.89) < 1, "A4 page geometry");
    for (const item of page.items) {
      const x = item.transform[4];
      const y = item.transform[5];
      assert.ok(x >= 15 && x + item.width <= page.width - 15, `Horizontal clipping on page ${index + 1}: ${item.str}`);
      assert.ok(y >= 15 && y <= page.height - 15, `Vertical clipping on page ${index + 1}: ${item.str}`);
    }
    for (const heading of ["Professional Summary", "Professional Experience", "Education", "Skills", "Certifications", "Projects", "Languages", "Additional Information"]) {
      const position = page.items.findIndex((item) => item.str === heading);
      if (position >= 0) assert.ok(position < page.items.length - 1, `Orphaned ${heading} on page ${index + 1}`);
    }
    for (let first = 0; first < page.items.length; first++) {
      for (let second = first + 1; second < page.items.length; second++) {
        const a = page.items[first]; const b = page.items[second];
        if (Math.abs(a.transform[5] - b.transform[5]) >= 1.5) continue;
        const overlap = Math.min(a.transform[4] + a.width, b.transform[4] + b.width) - Math.max(a.transform[4], b.transform[4]);
        assert.ok(overlap < 2, `Overlapping extracted text on page ${index + 1}: ${a.str} / ${b.str}`);
      }
    }
  }
});

test("minimal valid PDF uses only required supplied content and no optional placeholders", async () => {
  const profile = createLongGlobalAtsQaProfile();
  profile.professionalSummary = undefined;
  profile.workExperience = [];
  profile.education = [];
  profile.certifications = [];
  profile.projects = [];
  profile.languages = [];
  profile.additionalSections = [];
  profile.skills = [profile.skills[0]];
  const model = buildGlobalAtsResumeModel(mapCandidateProfileToDocumentData(profile, "resume"));
  assert.deepEqual(model.sections.map((section) => section.title ?? "Identity"), ["Identity", "Skills"]);
  const pages = await inspect(await renderPdfDocument(model));
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /Verified fictional operations skill 1/);
  assert.doesNotMatch(pages[0].text, /Professional Summary|Professional Experience|Education|Certifications|Projects|Languages|Additional Information|undefined/);
});

test("safe filename is bounded and contains no internal ID or unsafe path character", () => {
  const name = buildPdfFilename({ candidateName: `${createLongGlobalAtsQaProfile().fullName} ../../\\ ${"Long ".repeat(40)}`, output: "global-ats-resume" });
  assert.match(name, /_Global_ATS_Resume\.pdf$/);
  assert.ok(name.length < 110);
  assert.doesNotMatch(name, /\.\.|[\\/]|00000000-/);
});

test("production and QA downloads enforce role gate and ignore browser-supplied facts", async () => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const productionUrl = `http://localhost:3000/admin/clients/${userId}/global-ats/download`;
  const qaUrl = "http://localhost:3000/admin/pdf-render-test/download";
  const context = { params: Promise.resolve({ userId }) };
  const productionRequest = () => new Request(productionUrl, { method: "POST", headers: { origin: "http://localhost:3000" },
    body: new URLSearchParams({ fullName: "Injected Candidate", employer: "Injected Employer" }) });
  const qaRequest = () => new Request(qaUrl, { method: "POST", headers: { origin: "http://localhost:3000" },
    body: new URLSearchParams({ scenario: "global-ats-long", fullName: "Injected Candidate" }) });
  globalThis.__atsProfile = createLongGlobalAtsQaProfile();
  for (const role of [null, "client"]) {
    globalThis.__atsAccess = role;
    await assert.rejects(() => productionDownload(productionRequest(), context), /ACCESS_DENIED/);
    await assert.rejects(() => qaDownload(qaRequest()), /ACCESS_DENIED/);
  }
  globalThis.__atsAccess = "admin";
  const production = await productionDownload(productionRequest(), context);
  assert.equal(production.status, 200);
  assert.match(production.headers.get("cache-control"), /private, no-store/);
  const productionText = (await inspect(Buffer.from(await production.arrayBuffer()))).map((page) => page.text).join(" ");
  assert.match(productionText, /Rohan Kapoor Fictional International/);
  assert.doesNotMatch(productionText, /Injected Candidate|Injected Employer/);
  const qa = await qaDownload(qaRequest());
  assert.equal(qa.status, 200);
  assert.match(qa.headers.get("cache-control"), /private, no-store/);
  assert.match(qa.headers.get("content-disposition"), /Global_ATS_Resume\.pdf/);
  assert.doesNotMatch(qa.headers.get("content-disposition"), /00000000-|Injected/);
  const qaText = (await inspect(Buffer.from(await qa.arrayBuffer()))).map((page) => page.text).join(" ");
  assert.match(qaText, /Professional Experience/);
  assert.doesNotMatch(qaText, /Injected Candidate/);
});

test("route source remains server-authorized and does not use submitted candidate content", () => {
  const route = read("src/app/admin/clients/[userId]/global-ats/download/route.ts");
  const loader = read("src/features/document-generation/admin-global-ats-service.ts");
  const qaRoute = read("src/app/admin/pdf-render-test/download/route.ts");
  assert.match(loader, /requireApplicationRole\("admin"\)/);
  assert.match(loader, /candidate_profile_id/);
  assert.match(route, /loadAdminCandidateProfile\(userId\)/);
  assert.doesNotMatch(route, /request\.formData|request\.json|SUPABASE_SECRET_KEY/);
  assert.match(qaRoute, /requireApplicationRole\("admin"\)/);
  assert.doesNotMatch(read("src/app/admin/layout.tsx"), /pdf-render-test/);
});
