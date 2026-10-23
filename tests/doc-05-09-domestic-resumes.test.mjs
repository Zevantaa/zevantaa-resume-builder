import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: "data:text/javascript,export async function requireApplicationRole(role){if(globalThis.__domesticQaRole!==role)throw Error('ACCESS_DENIED')}", shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: "data:text/javascript,export async function loadAdminCandidateProfile(userId){if(globalThis.__domesticQaRole!=='admin')throw Error('ACCESS_DENIED');globalThis.__domesticQaLoadedId=userId;return globalThis.__domesticQaProfile}", shortCircuit: true,
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

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildDomesticResumeModel, DOMESTIC_DESIGNS, DomesticResumeNotReadyError } = await import("../src/features/document-generation/domestic-resumes.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { POST: productionDownload } = await import("../src/app/admin/clients/[userId]/domestic-resumes/download/route.ts");
const { POST: qaDownload } = await import("../src/app/admin/pdf-render-test/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { mockPersistedRoutePdf } = await import("./doc13-route-mock.mjs");
globalThis.__doc13RouteMock = async (_id, output) => mockPersistedRoutePdf(globalThis.__domesticQaProfile, output);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function inspect(buffer) {
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buffer.length > 1000);
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
  const profile = createLongGlobalAtsQaProfile();
  profile.professionalSummary = undefined;
  profile.workExperience = []; profile.education = []; profile.skills = [profile.skills[0]];
  profile.certifications = []; profile.projects = []; profile.languages = []; profile.additionalSections = [];
  return profile;
}
function normal() {
  const profile = createLongGlobalAtsQaProfile();
  profile.professionalSummary = "Candidate-supplied fictional operations summary.";
  profile.workExperience = profile.workExperience.slice(0, 2).map((entry) => ({ ...entry, highlights: entry.highlights.slice(0, 1) }));
  profile.education = profile.education.slice(0, 1); profile.skills = profile.skills.slice(0, 5);
  profile.certifications = profile.certifications.slice(0, 1);
  return profile;
}

test("five design IDs have intentionally distinct composition and print themes", () => {
  assert.deepEqual(DOMESTIC_DESIGNS.map((item) => item.id), ["1", "2", "3", "4", "5"]);
  const mapping = mapCandidateProfileToDocumentData(normal(), "resume");
  const outputs = DOMESTIC_DESIGNS.map((item) => buildDomesticResumeModel(mapping, item.id));
  assert.equal(new Set(outputs.map((output) => JSON.stringify(output.theme))).size, 5);
  assert.equal(new Set(outputs.map((output) => JSON.stringify(output.model.sections))).size, 5);
  assert.equal(outputs[0].model.sections[1].headingStyle, "ruled");
  assert.equal(outputs[1].model.sections[0].blocks[0].kind, "banner");
  assert.equal(outputs[2].model.sections[1].headingStyle, "uppercase");
  assert.ok(outputs[3].model.sections.some((section) => section.blocks.some((block) => block.kind === "columns")));
  assert.ok(outputs.filter((output) => output.model.sections.some((section) => section.blocks.some((block) => block.kind === "columns"))).length === 1);
  assert.ok(outputs[4].theme.typography.heading1Size > outputs[0].theme.typography.heading1Size);
});

for (const design of DOMESTIC_DESIGNS) {
  test(`Domestic ${design.id}: minimal PDF omits empty optional sections`, async () => {
    const output = buildDomesticResumeModel(mapCandidateProfileToDocumentData(minimal(), "resume"), design.id);
    const pages = await inspect(await renderPdfDocument(output.model, output.theme));
    assert.equal(pages.length, 1, `Domestic ${design.id} minimal profile should fit one page`);
    const text = pages.map((page) => page.text).join(" ");
    assert.match(text, /Rohan Kapoor Fictional International/);
    assert.match(text, /Verified fictional operations skill 1/);
    assert.doesNotMatch(text, /Professional Summary|Professional Experience|Education|Certifications|Projects|Languages|Additional Information|N\/A|undefined/);
  });

  test(`Domestic ${design.id}: normal PDF maps reviewed fields and explicit dates`, async (t) => {
    const output = buildDomesticResumeModel(mapCandidateProfileToDocumentData(normal(), "resume"), design.id);
    const pages = await inspect(await renderPdfDocument(output.model, output.theme));
    t.diagnostic(`Domestic ${design.id} normal: ${pages.length} A4 pages`);
    assert.equal(pages.length, 2, `Domestic ${design.id} normal profile should span two pages`);
    const text = pages.map((page) => page.text).join(" ");
    for (const phrase of ["rohan.kapoor.qa@example.invalid", "Professional Summary", "Professional Experience",
      "Fictional International Distribution", "Education", "CGPA 8.1/10", "2017", "Skills",
      "Certifications", "Issued: 2021", "Projects", "Languages", "Additional Information",
      "Role 1, supplied bullet 1", "Fictional Regional Reporting Project", "English (fluent)"]) {
      assert.ok(text.toLowerCase().includes(phrase.toLowerCase()), `Domestic ${design.id} missing ${phrase}`);
    }
    assert.ok(text.indexOf("Role 1, supplied bullet 1") < text.indexOf("Role 2, supplied bullet 1"));
    assert.doesNotMatch(text, /Jan 2017|Jan 2021|undefined|Placeholder/);
  });

  test(`Domestic ${design.id}: stress PDF retains text within page geometry`, async (t) => {
    const profile = createLongGlobalAtsQaProfile();
    const output = buildDomesticResumeModel(mapCandidateProfileToDocumentData(profile, "resume"), design.id);
    const buffer = await renderPdfDocument(output.model, output.theme);
    const pages = await inspect(buffer);
    t.diagnostic(`Domestic ${design.id}: ${pages.length} A4 pages`);
    assert.ok(pages.length >= 3, `Domestic ${design.id} should span at least 3 pages`);
    const text = pages.map((page) => page.text).join(" ");
    for (const phrase of ["Role 1, supplied bullet 1", "Role 6, supplied bullet 4", "Verified fictional operations skill 24",
      "Issued: May 2020", "Jul 2012", "May 2015", "CGPA 8.1/10", "Fictional Regional Reporting Project",
      "Volunteer-supplied bullet", "Hindi (professional working)"]) assert.ok(text.includes(phrase), `Domestic ${design.id} missing ${phrase}`);
    assert.ok(text.replace(/\s+/gu, "").includes(profile.linkedinUrl), `Domestic ${design.id} long URL was changed`);
    assert.ok((text.match(/•/gu) ?? []).length >= 24, `Domestic ${design.id} bullet markers missing`);
    assert.ok(text.indexOf("Role 1, supplied bullet 1") < text.indexOf("Role 6, supplied bullet 4"));
    for (const [pageIndex, page] of pages.entries()) {
      assert.ok(Math.abs(page.width - 595.28) < 1 && Math.abs(page.height - 841.89) < 1);
      for (const item of page.items) {
        const x = item.transform[4]; const y = item.transform[5];
        assert.ok(x >= 15 && x + item.width <= page.width - 15, `Domestic ${design.id} page ${pageIndex + 1} horizontal clipping: ${item.str}`);
        assert.ok(y >= 15 && y <= page.height - 15, `Domestic ${design.id} page ${pageIndex + 1} vertical clipping: ${item.str}`);
      }
      for (let first = 0; first < page.items.length; first++) for (let second = first + 1; second < page.items.length; second++) {
        const a = page.items[first]; const b = page.items[second];
        if (Math.abs(a.transform[5] - b.transform[5]) >= 1.5) continue;
        const overlap = Math.min(a.transform[4] + a.width, b.transform[4] + b.width) - Math.max(a.transform[4], b.transform[4]);
        assert.ok(overlap < 2, `Domestic ${design.id} page ${pageIndex + 1} text overlap: ${a.str} / ${b.str}`);
      }
    }
    const safeName = buildPdfFilename({ candidateName: profile.fullName, output: `domestic-resume-${design.id}` });
    assert.match(safeName, new RegExp(`_Domestic_Resume_${design.id}\\.pdf$`));
    assert.doesNotMatch(safeName, /[\\/]|00000000-/);
    globalThis[`__domesticPdfHash${design.id}`] = createHash("sha256").update(buffer).digest("hex");
  });
}

test("stress outputs are not byte-equivalent", () => {
  const hashes = DOMESTIC_DESIGNS.map((design) => globalThis[`__domesticPdfHash${design.id}`]);
  assert.equal(new Set(hashes).size, 5);
});

test("incomplete or non-domestic package cannot generate", () => {
  const absent = minimal(); absent.fullName = "";
  assert.throws(() => buildDomesticResumeModel(mapCandidateProfileToDocumentData(absent, "resume"), "1"), DomesticResumeNotReadyError);
  const gcc = normal(); gcc.selectedPackage = "gcc-middle-east"; gcc.targetMarkets = ["gcc-middle-east"];
  assert.throws(() => buildDomesticResumeModel(mapCandidateProfileToDocumentData(gcc, "resume"), "2"), DomesticResumeNotReadyError);
});

test("production POST reloads canonical data, denies other roles, validates design and package", async () => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const url = `http://localhost:3000/admin/clients/${userId}/domestic-resumes/download`;
  const request = (design, origin = "http://localhost:3000") => new Request(url, { method: "POST", headers: { origin },
    body: new URLSearchParams({ design, fullName: "Injected Candidate", jobTitle: "Injected Role" }) });
  const context = { params: Promise.resolve({ userId }) };
  globalThis.__domesticQaProfile = normal();
  for (const role of [null, "client"]) {
    globalThis.__domesticQaRole = role;
    await assert.rejects(() => productionDownload(request("1"), context), /ACCESS_DENIED/);
  }
  globalThis.__domesticQaRole = "admin";
  assert.equal((await productionDownload(request("9"), context)).status, 400);
  assert.equal((await productionDownload(request("1", "https://elsewhere.invalid"), context)).status, 403);
  const gcc = normal(); gcc.selectedPackage = "gcc-middle-east"; gcc.targetMarkets = ["gcc-middle-east"];
  globalThis.__domesticQaProfile = gcc;
  assert.equal((await productionDownload(request("1"), context)).status, 422);
  globalThis.__domesticQaProfile = normal();
  const response = await productionDownload(request("2"), context);
  assert.equal(globalThis.__domesticQaLoadedId, userId);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.match(response.headers.get("content-disposition"), /Domestic_Resume_2\.pdf/);
  const text = (await inspect(Buffer.from(await response.arrayBuffer()))).map((page) => page.text).join(" ");
  assert.match(text, /Rohan Kapoor Fictional International/);
  assert.doesNotMatch(text, /Injected Candidate|Injected Role/);
});

test("admin-only QA accepts only five fixed fictional domestic scenarios", async () => {
  const url = "http://localhost:3000/admin/pdf-render-test/download";
  const request = (scenario) => new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" },
    body: new URLSearchParams({ scenario, fullName: "Injected Candidate" }) });
  for (const role of [null, "client"]) {
    globalThis.__domesticQaRole = role;
    await assert.rejects(() => qaDownload(request("domestic-1")), /ACCESS_DENIED/);
  }
  globalThis.__domesticQaRole = "admin";
  assert.equal((await qaDownload(request("domestic-9"))).status, 400);
  for (const design of DOMESTIC_DESIGNS) {
    const response = await qaDownload(request(`domestic-${design.id}`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), new RegExp(`Domestic_Resume_${design.id}\\.pdf`));
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    const pages = await inspect(Buffer.from(await response.arrayBuffer()));
    assert.ok(pages.length >= 3);
    assert.doesNotMatch(pages.map((page) => page.text).join(" "), /Injected Candidate/);
  }
});

test("source boundaries keep secret keys and candidate data out of browser inputs", () => {
  const route = read("src/app/admin/clients/[userId]/domestic-resumes/download/route.ts");
  const loader = read("src/features/document-generation/admin-global-ats-service.ts");
  assert.match(loader, /requireApplicationRole\("admin"\)/);
  assert.match(loader, /candidate_profile_id/);
  assert.match(route, /loadAdminCandidateProfile\(userId\)/);
  assert.doesNotMatch(route, /SUPABASE_SECRET_KEY|service_role|request\.json/);
  assert.doesNotMatch(read("src/features/document-generation/pdf/pdf-render-qa-panel.tsx"), /SUPABASE_SECRET_KEY|service_role/);
  assert.doesNotMatch(read("src/app/admin/layout.tsx"), /pdf-render-test/);
});

test("Domestic 2 keeps Professional Experience with the first role at page boundaries", async () => {
  for (const count of [50, 60]) {
    const profile = normal();
    profile.professionalSummary = "Candidate-supplied fictional summary for pagination review. ".repeat(count);
    const output = buildDomesticResumeModel(mapCandidateProfileToDocumentData(profile, "resume"), "2");
    const experience = output.model.sections.find((section) => section.id === "experience");
    assert.equal(experience.keepWithFirstEntry, true);
    const pages = await inspect(await renderPdfDocument(output.model, output.theme));
    const headingPage = pages.findIndex((page) => page.text.includes("Professional Experience"));
    const rolePage = pages.findIndex((page) => page.text.includes("Regional Planning Division 1"));
    assert.ok(headingPage >= 0);
    assert.equal(rolePage, headingPage, "Section heading must not be stranded without the first role.");
    assert.ok(pages[headingPage].text.includes("Fictional International Distribution and Business Process Cooperative"),
      "The first employer metadata must stay with the heading and role title.");
  }
  const mapping = mapCandidateProfileToDocumentData(normal(), "resume");
  for (const design of ["1", "3", "4", "5"]) {
    const output = buildDomesticResumeModel(mapping, design);
    assert.ok(output.model.sections.every((section) => !section.keepWithFirstEntry),
      `Domestic ${design} pagination settings remain unchanged.`);
  }
});

test("Domestic 2 stress PDF never orphans Professional Experience from its first role", async (t) => {
  const profile = createLongGlobalAtsQaProfile();
  const output = buildDomesticResumeModel(mapCandidateProfileToDocumentData(profile, "resume"), "2");
  const pages = await inspect(await renderPdfDocument(output.model, output.theme));
  t.diagnostic(`Domestic 2 exact stress fixture: ${pages.length} pages`);
  assert.ok(pages.length >= 3);
  const headingPage = pages.findIndex((page) => page.text.includes("Professional Experience"));
  const firstRoleTitle = "Senior Fictional Operations and Supply Chain Programme Coordination Manager";
  assert.ok(headingPage >= 0);
  if (pages[0].text.includes("Professional Experience")) {
    assert.ok(pages[0].text.includes(firstRoleTitle),
      "Page 1 must not end with Professional Experience without the first role title.");
  }
  assert.ok(pages[headingPage].text.includes(firstRoleTitle),
    `Professional Experience is orphaned on page ${headingPage + 1}; first role must appear on that page.`);
  assert.ok(pages[headingPage].text.includes("Fictional International Distribution and Business Process Cooperative"),
    "The first employer metadata must appear with the section heading and role title.");
});
