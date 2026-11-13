import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: "data:text/javascript,export async function requireApplicationRole(role){if(globalThis.__europeanQaRole!==role)throw Error('ACCESS_DENIED')}", shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: "data:text/javascript,export async function loadAdminCandidateProfile(userId){if(globalThis.__europeanQaRole!=='admin')throw Error('ACCESS_DENIED');globalThis.__europeanLoadedUserId=userId;return globalThis.__europeanQaProfile}", shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/persistent-document-service") return {
    url: "data:text/javascript,export async function generateAndPersistAdminDocument(profileId,output){return globalThis.__doc13RouteMock(profileId,output)}", shortCircuit: true,
  };
  if (specifier.startsWith("@/features/document-generation/")) {
    return nextResolve(new URL(`../src/features/document-generation/${specifier.slice("@/features/document-generation/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { createEuropeanQaProfile } = await import("../src/features/document-generation/european-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildEuropeanResumeModel, isEuropeanPackageEligible, EuropeanResumeNotReadyError } = await import("../src/features/document-generation/european-resume.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { POST: productionDownload } = await import("../src/app/admin/clients/[userId]/european-resume/download/route.ts");
const { POST: qaDownload } = await import("../src/app/admin/pdf-render-test/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { mockPersistedRoutePdf } = await import("./doc13-route-mock.mjs");
globalThis.__doc13RouteMock = async (_id, output) => mockPersistedRoutePdf(globalThis.__europeanQaProfile, output);
const mapping = (profile) => mapCandidateProfileToDocumentData(profile, "resume");
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

test("entitlement uses the frozen seven-package catalog", () => {
  const allowed = ["europass-european-union", "domestic-europass-european-union", "global-mobility-master", "executive-transition-agency-distribution"];
  const denied = ["indian-domestic", "gcc-middle-east", "domestic-gcc"];
  for (const code of allowed) {
    const profile = createEuropeanQaProfile(); profile.selectedPackage = code;
    assert.equal(isEuropeanPackageEligible(mapping(profile).data), true, code);
    assert.ok(buildEuropeanResumeModel(mapping(profile)).model.sections.length);
  }
  for (const code of denied) {
    const profile = createEuropeanQaProfile(); profile.selectedPackage = code;
    assert.equal(isEuropeanPackageEligible(mapping(profile).data), false, code);
    assert.throws(() => buildEuropeanResumeModel(mapping(profile)), EuropeanResumeNotReadyError);
  }
  const invalid = createEuropeanQaProfile(); invalid.selectedPackage = "unknown-package";
  assert.throws(() => buildEuropeanResumeModel(mapping(invalid)), EuropeanResumeNotReadyError);
});

test("minimal profile renders one page and omits empty optional sections and claims", async (t) => {
  const profile = createEuropeanQaProfile();
  profile.professionalSummary = undefined; profile.workExperience = []; profile.education = [];
  profile.skills = profile.skills.slice(0, 1); profile.certifications = []; profile.projects = [];
  profile.languages = []; profile.additionalSections = []; profile.linkedinUrl = undefined;
  profile.whatsappNumber = undefined; profile.currentLocation = ""; profile.relocationPreference = "not-specified";
  const output = buildEuropeanResumeModel(mapping(profile));
  assert.deepEqual(output.model.sections.map((section) => section.id), ["identity", "skills"]);
  const pages = await inspect(await renderPdfDocument(output.model, output.theme));
  t.diagnostic(`European minimal: ${pages.length} A4 pages`);
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /Rohan Kapoor|Verified fictional operations skill 1/);
  assert.doesNotMatch(pages[0].text, /Work Experience|Education and Training|Certifications|Projects|Languages|N\/A|undefined|nationality|visa/i);
});

test("normal profile retains all sections, explicit dates and supplied detail", async (t) => {
  const profile = createEuropeanQaProfile();
  const output = buildEuropeanResumeModel(mapping(profile));
  assert.deepEqual(output.model.sections.map((section) => section.id),
    ["identity", "summary", "experience", "education", "skills", "languages", "certifications", "projects", `additional-${profile.additionalSections[0].id}`]);
  const pages = await inspect(await renderPdfDocument(output.model, output.theme));
  t.diagnostic(`European normal: ${pages.length} A4 pages`);
  assert.ok(pages.length >= 1 && pages.length <= 3);
  const text = pages.map((page) => page.text).join(" ");
  for (const phrase of ["Europass Curriculum Vitae", "PERSONAL INFORMATION", "Professional Profile", "Work Experience", "Education and Training",
    "Skills", "Languages", "Certifications", "Projects", "Additional Information", "Jan 2014 - Dec 2014",
    "CGPA 8.1/10", "Issued: 2021", "Hindi (professional working)", "Role 1, supplied bullet 1"]) {
    assert.ok(text.includes(phrase), `Missing ${phrase}`);
  }
  assert.ok(text.indexOf("Work Experience") < text.indexOf("Education and Training"));
  assert.ok(text.indexOf("Skills") < text.indexOf("Languages"));
  assert.ok(text.indexOf("Languages") < text.indexOf("Certifications"));
  assert.doesNotMatch(text, /official Europass|CEFR|nationality|visa status|work rights|N\/A|undefined/i);
  assert.doesNotMatch(Buffer.from(await renderPdfDocument(output.model, output.theme)).toString("latin1"), /\/Subtype\s*\/Image/);
});

test("long PDF has 3+ pages, grouped opening metadata, flowing body and safe geometry", async (t) => {
  const profile = createEuropeanQaProfile(true);
  const output = buildEuropeanResumeModel(mapping(profile));
  const pages = await inspect(await renderPdfDocument(output.model, output.theme));
  t.diagnostic(`European long: ${pages.length} A4 pages`);
  assert.ok(pages.length >= 3);
  const text = pages.map((page) => page.text).join(" ");
  for (const [index, role] of profile.workExperience.entries()) {
    const date = index < 5 ? `Jan ${2014 + index} - Dec ${2014 + index}` : "Jan 2019 - Present";
    const datePages = pages.filter((page) => page.text.includes(date));
    assert.equal(datePages.length, 1, date);
    assert.ok(datePages[0].text.includes(`Planning Division ${index + 1}`), `${date} stranded from ${role.jobTitle}`);
    assert.ok(datePages[0].text.includes(`Regional Office ${index + 1}`), `${date} stranded from employer`);
    assert.ok(datePages[0].text.includes(`Coordination Centre ${index + 1}`), `${date} stranded from location`);
  }
  assert.ok(text.includes("Role 6, supplied bullet 4"));
  assert.ok(text.includes("Verified fictional operations skill 24"));
  assert.ok(text.replace(/\s+/gu, "").includes(profile.linkedinUrl));
  assert.ok(text.indexOf("Role 1, supplied bullet 1") < text.indexOf("Role 6, supplied bullet 4"));
  assert.doesNotMatch(text, /CEFR|nationality|visa status|work rights|N\/A|undefined/i);
  for (const [pageIndex, page] of pages.entries()) {
    assert.ok(Math.abs(page.width - 595.28) < 1 && Math.abs(page.height - 841.89) < 1);
    for (const item of page.items) {
      const x = item.transform[4]; const y = item.transform[5];
      assert.ok(x >= 15 && x + item.width <= page.width - 15, `page ${pageIndex + 1} horizontal clip: ${item.str}`);
      assert.ok(y >= 15 && y <= page.height - 15, `page ${pageIndex + 1} vertical clip: ${item.str}`);
    }
    for (let first = 0; first < page.items.length; first++) for (let second = first + 1; second < page.items.length; second++) {
      const a = page.items[first]; const b = page.items[second];
      if (Math.abs(a.transform[5] - b.transform[5]) >= 1.5) continue;
      const overlap = Math.min(a.transform[4] + a.width, b.transform[4] + b.width) - Math.max(a.transform[4], b.transform[4]);
      assert.ok(overlap < 2, `page ${pageIndex + 1} text overlap: ${a.str} / ${b.str}`);
    }
  }
  const filename = buildPdfFilename({ candidateName: profile.fullName.repeat(5), output: "europass-eu-resume" });
  assert.match(filename, /_Europass_EU_Resume\.pdf$/);
  assert.doesNotMatch(filename, /[\\/]|00000000-/);
});

test("production route is admin-only, reloads facts and rejects browser tampering", async () => {
  const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const url = `http://localhost:3000/admin/clients/${userId}/european-resume/download`;
  const request = (origin = "http://localhost:3000") => new Request(url, { method: "POST", headers: { origin },
    body: new URLSearchParams({ candidate_profile_id: "injected", fullName: "Injected Candidate", package: "europass-european-union" }) });
  const context = { params: Promise.resolve({ userId }) };
  globalThis.__europeanQaProfile = createEuropeanQaProfile();
  for (const role of [null, "client"]) {
    globalThis.__europeanQaRole = role;
    await assert.rejects(() => productionDownload(request(), context), /ACCESS_DENIED/);
  }
  globalThis.__europeanQaRole = "admin";
  assert.equal((await productionDownload(request("https://elsewhere.invalid"), context)).status, 403);
  const response = await productionDownload(request(), context);
  assert.equal(response.status, 200);
  assert.equal(globalThis.__europeanLoadedUserId, userId);
  assert.match(response.headers.get("content-disposition"), /_Europass_EU_Resume\.pdf/);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  const text = (await inspect(Buffer.from(await response.arrayBuffer()))).map((page) => page.text).join(" ");
  assert.match(text, /Rohan Kapoor/);
  assert.doesNotMatch(text, /Injected Candidate|injected|candidate-intake-private/);
  const denied = createEuropeanQaProfile(); denied.selectedPackage = "gcc-middle-east";
  globalThis.__europeanQaProfile = denied;
  assert.equal((await productionDownload(request(), context)).status, 422);
});

test("admin-only QA harness offers fixed normal and long fictional scenarios", async (t) => {
  const url = "http://localhost:3000/admin/pdf-render-test/download";
  const request = (scenario) => new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" },
    body: new URLSearchParams({ scenario, fullName: "Injected Candidate" }) });
  for (const role of [null, "client"]) {
    globalThis.__europeanQaRole = role;
    await assert.rejects(() => qaDownload(request("european-normal")), /ACCESS_DENIED/);
  }
  globalThis.__europeanQaRole = "admin";
  assert.equal((await qaDownload(request("european-unknown"))).status, 400);
  for (const scenario of ["european-normal", "european-long"]) {
    const response = await qaDownload(request(scenario));
    assert.equal(response.status, 200, scenario);
    assert.match(response.headers.get("content-disposition"), /_Europass_EU_Resume\.pdf/);
    const pages = await inspect(Buffer.from(await response.arrayBuffer()));
    t.diagnostic(`${scenario}: ${pages.length} A4 pages`);
    if (scenario === "european-long") assert.ok(pages.length >= 3);
    assert.doesNotMatch(pages.map((page) => page.text).join(" "), /Injected Candidate/);
  }
});

test("source boundaries contain no public storage access or browser service secrets", () => {
  const route = read("src/app/admin/clients/[userId]/european-resume/download/route.ts");
  const loader = read("src/features/document-generation/admin-global-ats-service.ts");
  const panel = read("src/features/document-generation/pdf/pdf-render-qa-panel.tsx");
  assert.match(loader, /requireApplicationRole\("admin"\)/);
  assert.match(route, /loadAdminCandidateProfile\(userId\)/);
  assert.doesNotMatch(route, /request\.json|getPublicUrl|createSignedUrl|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(panel, /SUPABASE_SECRET_KEY|service_role|candidate-intake-private/);
});
