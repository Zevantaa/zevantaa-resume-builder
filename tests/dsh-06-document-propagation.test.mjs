import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/features/document-generation/"))
    return nextResolve(new URL(`../src/features/document-generation/${specifier.slice(31)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { calculateIndicativeAtsScore } = await import("../src/features/document-generation/indicative-ats-score.ts");
const { buildGlobalAtsResumeModel } = await import("../src/features/document-generation/global-ats-resume.ts");
const { buildDomesticResumeModel } = await import("../src/features/document-generation/domestic-resumes.ts");
const { buildGccResumeModel } = await import("../src/features/document-generation/gcc-resume.ts");
const { buildEuropeanResumeModel } = await import("../src/features/document-generation/european-resume.ts");
const { buildCoverLetterModel } = await import("../src/features/document-generation/cover-letters.ts");
const { buildPrivacyMaskedEmployerResume } = await import("../src/features/document-generation/privacy-masked-resume.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const updatedRole = "Client Authored Fictional Senior Operations Director";
function updatedProfile() {
  const profile = createLongGlobalAtsQaProfile();
  profile.selectedPackage = "executive-transition-agency-distribution";
  profile.targetMarkets = ["indian-domestic", "gcc-middle-east", "european-union"];
  profile.professionalSummary = "Client-authored fictional summary about current supply-chain planning.";
  profile.workExperience.at(-1).jobTitle = updatedRole;
  profile.skills[0].name = "Client-authored fictional inventory forecasting";
  return profile;
}

test("ATS readiness and score recalculate from edited canonical facts without a 90 floor", () => {
  const full = updatedProfile();
  const strong = calculateIndicativeAtsScore(mapCandidateProfileToDocumentData(full, "resume"));
  const sparse = structuredClone(full);
  sparse.workExperience = [];
  sparse.skills = [];
  sparse.certifications = [];
  sparse.projects = [];
  sparse.languages = [];
  sparse.professionalSummary = "";
  const weak = calculateIndicativeAtsScore(mapCandidateProfileToDocumentData(sparse, "resume"));
  assert.equal(strong.status, "ready");
  assert.equal(weak.benchmark, 90);
  assert.equal(weak.status, "ready");
  assert.ok(weak.score < strong.score);
  assert.ok(weak.score < 90);
});

test("every entitled resume family consumes updated role, not the old role", () => {
  const profile = updatedProfile();
  const mapped = mapCandidateProfileToDocumentData(profile, "resume");
  const oldRole = createLongGlobalAtsQaProfile().workExperience.at(-1).jobTitle;
  const models = [buildGlobalAtsResumeModel(mapped),
    ...["1", "2", "3", "4", "5"].map((design) => buildDomesticResumeModel(mapped, design).model),
    buildGccResumeModel(mapped).model, buildEuropeanResumeModel(mapped).model];
  for (const model of models) {
    const text = JSON.stringify(model);
    assert.ok(text.includes(updatedRole));
    assert.equal(text.includes(oldRole), false);
  }
});

test("privacy copy retains updated career content while normal copy retains contact routes", () => {
  const profile = updatedProfile();
  const mapped = mapCandidateProfileToDocumentData(profile, "resume");
  const normal = JSON.stringify(buildGlobalAtsResumeModel(mapped));
  const masked = JSON.stringify(buildPrivacyMaskedEmployerResume(mapped).model);
  assert.ok(normal.includes(updatedRole));
  assert.ok(normal.includes(profile.primaryEmail));
  assert.ok(masked.includes(updatedRole));
  for (const contact of [profile.primaryEmail, profile.mobileNumber, profile.whatsappNumber, profile.linkedinUrl]) {
    assert.equal(masked.includes(contact), false);
  }
});

test("cover-letter content uses newly supplied role and employer where entitled", () => {
  const profile = updatedProfile();
  const mapped = mapCandidateProfileToDocumentData(profile, "cover-letter");
  for (const type of ["general-corporate", "international-relocation", "technology-startup"]) {
    const letter = buildCoverLetterModel(mapped, type);
    const text = JSON.stringify(letter.content);
    assert.ok(text.includes(updatedRole));
    assert.ok(text.includes(profile.workExperience.at(-1).employerName));
  }
});

test("fresh Global ATS output remains a selectable text PDF with the client update", async () => {
  const model = buildGlobalAtsResumeModel(mapCandidateProfileToDocumentData(updatedProfile(), "resume"));
  const bytes = await renderPdfDocument(model);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    let text = "";
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      text += content.items.map((item) => item.str ?? "").join(" ");
    }
    assert.ok(text.includes(updatedRole));
    assert.equal(text.includes(createLongGlobalAtsQaProfile().workExperience.at(-1).jobTitle), false);
  } finally { await pdf.destroy(); }
});

test("production generators reload the authorized canonical profile server-side for each request", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  for (const route of ["global-ats/download", "global-ats/privacy-masked/download", "domestic-resumes/download",
    "gcc-resume/download", "european-resume/download", "cover-letters/download"]) {
    assert.match(read(`src/app/admin/clients/[userId]/${route}/route.ts`), /loadAdminCandidateProfile\(userId\)/);
  }
  assert.match(read("src/features/document-generation/admin-global-ats-service.ts"), /requireApplicationRole\("admin"\)/);
  const adminWorkspace = read("src/app/admin/clients/[userId]/documents/page.tsx");
  assert.match(adminWorkspace, /loadAdminCandidateProfile\(userId\)/);
  assert.match(adminWorkspace, /Current structured career profile/);
});
