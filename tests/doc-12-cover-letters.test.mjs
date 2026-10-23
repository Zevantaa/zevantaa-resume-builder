import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: "data:text/javascript,export async function requireApplicationRole(role){if(globalThis.__letterQaRole!==role)throw Error('ACCESS_DENIED')}", shortCircuit: true,
  };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: "data:text/javascript,export async function loadAdminCandidateProfile(userId){if(globalThis.__letterQaRole!=='admin')throw Error('ACCESS_DENIED');globalThis.__letterLoadedUserId=userId;return globalThis.__letterQaProfile}", shortCircuit: true,
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

const { createCoverLetterQaProfile } = await import("../src/features/document-generation/cover-letter-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildCoverLetterContent, buildCoverLetterModel, isCoverLetterPackageEligible,
  CoverLetterNotReadyError, COVER_LETTER_TYPES } = await import("../src/features/document-generation/cover-letters.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { POST: productionDownload } = await import("../src/app/admin/clients/[userId]/cover-letters/download/route.ts");
const { POST: qaDownload } = await import("../src/app/admin/pdf-render-test/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { mockPersistedRoutePdf } = await import("./doc13-route-mock.mjs");
globalThis.__doc13RouteMock = async (_id, output) => mockPersistedRoutePdf(globalThis.__letterQaProfile, output);
const map = (profile) => mapCandidateProfileToDocumentData(profile, "cover-letter");
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

test("only Executive All-Inclusive has explicit V1 cover-letter entitlement", () => {
  const profile = createCoverLetterQaProfile();
  assert.equal(isCoverLetterPackageEligible(map(profile).data), true);
  for (const code of ["indian-domestic", "gcc-middle-east", "europass-european-union", "domestic-gcc",
    "domestic-europass-european-union", "global-mobility-master", "unknown"]) {
    const denied = { ...profile, selectedPackage: code };
    assert.equal(isCoverLetterPackageEligible(map(denied).data), false, code);
    assert.throws(() => buildCoverLetterModel(map(denied), "general-corporate"), CoverLetterNotReadyError);
  }
});

test("three variants use reviewed facts with deterministic source paths and no unsupported claims", () => {
  const profile = createCoverLetterQaProfile();
  for (const type of COVER_LETTER_TYPES) {
    const first = buildCoverLetterContent(map(profile), type);
    const second = buildCoverLetterContent(map(profile), type);
    assert.deepEqual(first, second, `${type} must be deterministic`);
    assert.equal(first.salutation, "Dear Hiring Manager,");
    assert.equal(first.signOff, "Sincerely,");
    assert.equal(first.candidateName, profile.fullName);
    assert.ok(first.contactLines.join(" ").includes(profile.primaryEmail));
    const body = first.paragraphs.map((paragraph) => paragraph.text).join(" ");
    assert.doesNotMatch(body, /Candidate-supplied/i);
    assert.ok(!body.includes(profile.workExperience[1].highlights[0]), "long raw highlight must not be copied");
    assert.ok(!body.includes(profile.workExperience[1].description), "QA-meta role description must not be copied");
    assert.ok(body.includes(profile.workExperience[1].jobTitle));
    assert.ok(body.includes(profile.workExperience[1].employerName));
    assert.ok(!body.includes(profile.workExperience[1].location), "role location is omitted from prose");
    for (const skill of profile.skills.slice(0, 3)) assert.ok(body.includes(skill.name));
    assert.ok(!body.includes(profile.skills[3].name), "skill list is deliberately limited");
    assert.ok(!first.paragraphs.flatMap((paragraph) => paragraph.sourcePaths).includes("professionalSummary.text"), "unsuitable summary is omitted");
    assert.ok(first.paragraphs.flatMap((paragraph) => paragraph.sourcePaths).some((path) => path === `employment.${profile.workExperience[1].id}`));
    assert.doesNotMatch(body, /proven track record|significant revenue growth|industry leader|visa|work authori[sz]ation|sponsorship|citizenship|immigration eligibility|\[Company Name\]|N\/A|undefined/i);
  }
});

test("selects at most one short supplied evidence sentence and never truncates a long bullet", () => {
  const profile = createCoverLetterQaProfile();
  const latest = profile.workExperience[1];
  latest.description = "Coordinated weekly inventory reports for regional teams.";
  const withDescription = buildCoverLetterContent(map(profile), "general-corporate");
  const first = withDescription.paragraphs.map((item) => item.text).join(" ");
  assert.ok(first.includes(latest.description));
  assert.ok(!first.includes(latest.highlights[0]));
  assert.ok(withDescription.paragraphs.some((item) => item.sourcePaths.includes(`employment.${latest.id}.description`)));

  latest.description = "Long responsibility text ".repeat(20);
  latest.highlights[0] = "Prepared monthly operations handoff notes for regional teams.";
  const withHighlight = buildCoverLetterContent(map(profile), "general-corporate");
  const second = withHighlight.paragraphs.map((item) => item.text).join(" ");
  assert.ok(!second.includes(latest.description));
  assert.ok(second.includes(latest.highlights[0]));
  assert.ok(withHighlight.paragraphs.some((item) => item.sourcePaths.includes(`employment.${latest.id}.highlights.0`)));

  latest.highlights[0] = "Very long supplied bullet text ".repeat(20);
  const withoutEvidence = buildCoverLetterContent(map(profile), "general-corporate");
  const third = withoutEvidence.paragraphs.map((item) => item.text).join(" ");
  assert.ok(!third.includes(latest.description));
  assert.ok(!third.includes(latest.highlights[0]));
  assert.ok(third.includes(latest.jobTitle) && third.includes(latest.employerName));
});

test("relocation statement requires an explicit open or conditional preference", () => {
  const profile = createCoverLetterQaProfile();
  const letter = (preference) => {
    profile.relocationPreference = preference;
    return buildCoverLetterContent(map(profile), "international-relocation").paragraphs.map((item) => item.text).join(" ");
  };
  assert.match(letter("open"), /I am currently based in Fictional Chandigarh and am open to relocation/);
  const open = buildCoverLetterContent(map(profile), "international-relocation");
  assert.ok(open.paragraphs.some((item) => item.sourcePaths.includes("identity.relocationPreference") && item.sourcePaths.includes("identity.currentLocation")));
  assert.match(letter("conditional"), /my relocation preference is conditional/);
  assert.doesNotMatch(letter("not-open"), /open to relocation|relocation preference is conditional/);
  assert.doesNotMatch(letter("not-specified"), /open to relocation|relocation preference is conditional/);
});

test("technology content appears only when a reviewed project explicitly supplies it", () => {
  const profile = createCoverLetterQaProfile();
  const withProject = buildCoverLetterContent(map(profile), "technology-startup");
  const text = withProject.paragraphs.map((item) => item.text).join(" ");
  assert.match(text, /Fictional Regional Reporting Project/);
  assert.match(text, /Spreadsheet reporting/);
  assert.ok(withProject.paragraphs.flatMap((item) => item.sourcePaths).some((path) => path.endsWith("technologies.0")));
  assert.match(text, /My profile also includes project experience involving/);
  profile.projects = [];
  const withoutProject = buildCoverLetterContent(map(profile), "technology-startup").paragraphs.map((item) => item.text).join(" ");
  assert.doesNotMatch(withoutProject, /Fictional Regional Reporting Project|Spreadsheet reporting|project experience involving/);
  assert.doesNotMatch(withoutProject, /software engineer|developer|coding|cloud architect/i);
});

test("sparse profile is not ready, while short credible profiles remain concise without filler", () => {
  const sparse = createCoverLetterQaProfile(true);
  assert.equal(map(sparse).canGenerate, true, "mapper alone accepts one skill");
  for (const type of COVER_LETTER_TYPES) assert.throws(() => buildCoverLetterContent(map(sparse), type), CoverLetterNotReadyError);
  const summaryOnly = createCoverLetterQaProfile();
  summaryOnly.workExperience = []; summaryOnly.education = []; summaryOnly.skills = [];
  summaryOnly.certifications = []; summaryOnly.languages = []; summaryOnly.projects = []; summaryOnly.additionalSections = [];
  summaryOnly.professionalSummary = "Operations professional with documented experience coordinating inventory reporting and cross-functional planning for regional teams.";
  const content = buildCoverLetterContent(map(summaryOnly), "general-corporate");
  assert.equal(content.paragraphs.length, 3);
  assert.ok(content.paragraphs.some((item) => item.text.includes(summaryOnly.professionalSummary) &&
    item.sourcePaths.includes("professionalSummary.text")));
  assert.doesNotMatch(content.paragraphs.map((item) => item.text).join(" "), /\[|N\/A|undefined|No experience/);
});

test("all three normal fictional letters are one-page searchable A4 PDFs", async (t) => {
  const profile = createCoverLetterQaProfile();
  for (const type of COVER_LETTER_TYPES) {
    const output = buildCoverLetterModel(map(profile), type);
    const buffer = await renderPdfDocument(output.model, output.theme);
    const pages = await inspect(buffer);
    t.diagnostic(`${type}: ${pages.length} A4 pages`);
    assert.equal(pages.length, 1, type);
    assert.ok(Math.abs(pages[0].width - 595.28) < 1 && Math.abs(pages[0].height - 841.89) < 1);
    const text = pages[0].text;
    assert.match(text, /Rohan Kapoor|Dear Hiring Manager|Sincerely/);
    assert.ok(text.includes(profile.primaryEmail));
    assert.doesNotMatch(text, /Candidate-supplied/i);
    assert.ok(!text.includes(profile.workExperience[1].highlights[0]));
    assert.doesNotMatch(text, /\[Company Name\]|\[Recruiter\]|N\/A|undefined|visa status/i);
    assert.doesNotMatch(buffer.toString("latin1"), /\/Subtype\s*\/Image/);
    const filename = buildPdfFilename({ candidateName: profile.fullName.repeat(6), output: `${type}-cover-letter` });
    assert.match(filename, new RegExp(`_${({ "general-corporate": "General_Corporate", "international-relocation": "International_Relocation", "technology-startup": "Technology_Startup" })[type]}_Cover_Letter\\.pdf$`));
    assert.doesNotMatch(filename, /[\\/]|00000000-/);
  }
});

test("overlong supplied summary is omitted rather than dumped into a letter", async (t) => {
  const profile = createCoverLetterQaProfile();
  profile.professionalSummary = Array(35).fill(profile.professionalSummary).join(" ");
  const output = buildCoverLetterModel(map(profile), "general-corporate");
  assert.ok(!output.content.paragraphs.some((item) => item.sourcePaths.includes("professionalSummary.text")));
  const pages = await inspect(await renderPdfDocument(output.model, output.theme));
  t.diagnostic(`long-source cover letter: ${pages.length} pages`);
  assert.equal(pages.length, 1);
  for (const [index, page] of pages.entries()) for (const item of page.items) {
    const x = item.transform[4]; const y = item.transform[5];
    assert.ok(x >= 15 && x + item.width <= page.width - 15, `page ${index + 1} horizontal clip: ${item.str}`);
    assert.ok(y >= 15 && y <= page.height - 15, `page ${index + 1} vertical clip: ${item.str}`);
  }
});

test("production route denies signed-out/client access, reloads facts and rejects tampering", async () => {
  const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const url = `http://localhost:3000/admin/clients/${userId}/cover-letters/download`;
  const request = (type = "general-corporate", origin = "http://localhost:3000") => new Request(url, { method: "POST", headers: { origin },
    body: new URLSearchParams({ type, fullName: "Injected Candidate", employer: "Injected Employer", candidate_profile_id: "injected" }) });
  const context = { params: Promise.resolve({ userId }) };
  globalThis.__letterQaProfile = createCoverLetterQaProfile();
  for (const role of [null, "client"]) {
    globalThis.__letterQaRole = role;
    await assert.rejects(() => productionDownload(request(), context), /ACCESS_DENIED/);
  }
  globalThis.__letterQaRole = "admin";
  assert.equal((await productionDownload(request("general-corporate", "https://elsewhere.invalid"), context)).status, 403);
  assert.equal((await productionDownload(request("unknown"), context)).status, 400);
  for (const type of COVER_LETTER_TYPES) {
    const response = await productionDownload(request(type), context);
    assert.equal(response.status, 200, type);
    assert.equal(globalThis.__letterLoadedUserId, userId);
    assert.match(response.headers.get("content-disposition"), /_Cover_Letter\.pdf/);
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    const text = (await inspect(Buffer.from(await response.arrayBuffer()))).map((page) => page.text).join(" ");
    assert.match(text, /Rohan Kapoor/);
    assert.doesNotMatch(text, /Injected Candidate|Injected Employer|candidate-intake-private/);
  }
  const denied = createCoverLetterQaProfile(); denied.selectedPackage = "indian-domestic";
  globalThis.__letterQaProfile = denied;
  assert.equal((await productionDownload(request(), context)).status, 422);
});

test("QA harness serves only fixed fictional scenarios and signals sparse not-ready", async (t) => {
  const url = "http://localhost:3000/admin/pdf-render-test/download";
  const request = (scenario) => new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" },
    body: new URLSearchParams({ scenario, fullName: "Injected Candidate" }) });
  for (const role of [null, "client"]) {
    globalThis.__letterQaRole = role;
    await assert.rejects(() => qaDownload(request("cover-letter-general-corporate")), /ACCESS_DENIED/);
  }
  globalThis.__letterQaRole = "admin";
  assert.equal((await qaDownload(request("cover-letter-unknown"))).status, 400);
  assert.equal((await qaDownload(request("cover-letter-sparse"))).status, 422);
  for (const type of COVER_LETTER_TYPES) {
    const response = await qaDownload(request(`cover-letter-${type}`));
    assert.equal(response.status, 200, type);
    const pages = await inspect(Buffer.from(await response.arrayBuffer()));
    t.diagnostic(`${type} QA: ${pages.length} pages`);
    assert.doesNotMatch(pages.map((page) => page.text).join(" "), /Injected Candidate/);
  }
});

test("server-only boundaries contain no public storage or browser service secret", () => {
  const route = read("src/app/admin/clients/[userId]/cover-letters/download/route.ts");
  const loader = read("src/features/document-generation/admin-global-ats-service.ts");
  const panel = read("src/features/document-generation/pdf/pdf-render-qa-panel.tsx");
  assert.match(loader, /requireApplicationRole\("admin"\)/);
  assert.match(route, /loadAdminCandidateProfile\(userId\)/);
  assert.doesNotMatch(route, /request\.json|getPublicUrl|createSignedUrl|SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(panel, /SUPABASE_SECRET_KEY|service_role|candidate-intake-private/);
});
