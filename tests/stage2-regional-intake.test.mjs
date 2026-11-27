import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/features/document-generation/")) return nextResolve(
    new URL(`../src/features/document-generation/${specifier.slice("@/features/document-generation/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("@/features/client-portal/")) return nextResolve(
    new URL(`../src/features/client-portal/${specifier.slice("@/features/client-portal/".length)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("@/types/")) return nextResolve(
    new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") &&
      !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { validateRegionalIntake } = await import("../src/features/client-portal/regional-intake-validation.ts");
const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { calculateJobDescriptionCompatibility } = await import("../src/features/document-generation/job-description-compatibility.ts");
const { buildGlobalAtsResumeModel } = await import("../src/features/document-generation/global-ats-resume.ts");
const { buildGccResumeModel } = await import("../src/features/document-generation/gcc-resume.ts");
const { buildEuropeanResumeModel } = await import("../src/features/document-generation/european-resume.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const mapped = (profile) => mapCandidateProfileToDocumentData(profile, "resume");
const text = (model) => JSON.stringify(model.sections);

test("regional intake rejects unsupported claims, missing CEFR axes and ungrounded EQF", () => {
  assert.throws(() => validateRegionalIntake({ version: 1, admin: true }), /unsupported field/);
  assert.throws(() => validateRegionalIntake({ version: 1, global: { market: "germany" } }), /supported/);
  assert.throws(() => validateRegionalIntake({ version: 1, gcc: { photoConsent: "yes" } }), /explicit/);
  assert.throws(() => validateRegionalIntake({ version: 1, eu: { cefr: [{ language: "French", listening: "B2" }] } }), /all five/);
  assert.throws(() => validateRegionalIntake({ version: 1, eu: { eqf: [{ educationId: "fake", level: 6, verificationBasis: "Document" }] } }), /qualification/);
  assert.deepEqual(validateRegionalIntake({ version: 1, gcc: { photoConsent: false } }), { version: 1, gcc: {} });
});

test("job-description compatibility is calculated from candidate-confirmed facts", () => {
  const profile = createLongGlobalAtsQaProfile();
  profile.regionalIntake = validateRegionalIntake({ version: 1, global: {
    market: "usa", targetKeywords: ["inventory reporting", "unverified machine learning"],
    jobDescription: "Inventory reporting and machine learning for operations",
  } });
  const result = calculateJobDescriptionCompatibility(mapped(profile).data);
  assert.equal(result.score, 50);
  assert.deepEqual(result.matched, ["inventory reporting"]);
  assert.deepEqual(result.missing, ["unverified machine learning"]);
  assert.equal(result.algorithmVersion, "jd-keyword-v1");
  assert.equal(calculateJobDescriptionCompatibility(mapped({ ...profile, regionalIntake: undefined }).data), null);
});

test("Global ATS routes USA and Canada to Letter and other markets to A4", async () => {
  const profile = createLongGlobalAtsQaProfile();
  for (const market of ["usa", "canada", "india", "global-mnc", "uk", "australia"]) {
    profile.regionalIntake = { version: 1, global: { market, targetJobTitle: "Operations Director" } };
    const model = buildGlobalAtsResumeModel(mapped(profile));
    assert.equal(model.pageSize, market === "usa" || market === "canada" ? "LETTER" : "A4");
    assert.match(text(model), /Target role: Operations Director/);
    const task = getDocument({ data: new Uint8Array(await renderPdfDocument(model)), disableFontFace: true, isEvalSupported: false });
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    assert.ok(Math.abs(page.view[2] - (model.pageSize === "LETTER" ? 612 : 595.28)) < 1);
    await task.destroy();
  }
});

test("persisted template-version metadata can be embedded in selectable PDFs", async () => {
  const profile = createLongGlobalAtsQaProfile();
  profile.workExperience = profile.workExperience.slice(0, 1);
  const model = buildGlobalAtsResumeModel(mapped(profile));
  model.templateVersion = "stage2-regional-2026-11-28.1";
  const task = getDocument({ data: new Uint8Array(await renderPdfDocument(model)), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    const metadata = await pdf.getMetadata();
    assert.match(metadata.info.Subject, /stage2-regional-2026-11-28\.1/);
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    assert.match(content.items.filter((item) => "str" in item).map((item) => item.str).join(" "), /Rohan Kapoor/);
  } finally { await task.destroy(); }
});

test("GCC facts and photo are conditional; EU CEFR and EQF use linked verified education only", () => {
  const profile = createLongGlobalAtsQaProfile();
  profile.selectedPackage = "executive-transition-agency-distribution";
  profile.targetMarkets = ["indian-domestic", "gcc-middle-east", "european-union"];
  const educationId = profile.education[0].id;
  profile.regionalIntake = validateRegionalIntake({ version: 1,
    gcc: { nationality: "Indian", visaWorkStatus: "Status confirmed by candidate", photoConsent: true },
    eu: { motherTongue: "Hindi", workAuthorization: "Candidate-confirmed authorization",
      cefr: [{ language: "English", listening: "C1", reading: "C1", spokenInteraction: "B2", spokenProduction: "B2", writing: "C1" }],
      eqf: [{ educationId, level: 7, verificationBasis: "Candidate-provided classification source" }] },
  });
  const gcc = buildGccResumeModel(mapped(profile), "data:image/png;base64,fictional");
  assert.match(text(gcc.model), /Nationality: Indian/);
  assert.equal(gcc.model.sections[0].blocks[0].photoDataUri, undefined);
  profile.gccPhotoConsentAt = "2026-01-01T00:00:00Z";
  assert.ok(buildGccResumeModel(mapped(profile), "data:image/png;base64,fictional").model.sections[0].blocks[0].photoDataUri);
  const eu = buildEuropeanResumeModel(mapped(profile));
  assert.match(text(eu.model), /Spoken production.*B2/);
  assert.match(text(eu.model), /EQF level 7/);
  assert.doesNotMatch(text(buildEuropeanResumeModel(mapped({ ...profile, regionalIntake: undefined })).model), /EQF level|CEFR/);
});

test("regional migration is additive and revision-coupled without account or document deletion", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261127203902_regional_intake_v1.sql", import.meta.url), "utf8");
  assert.match(sql, /add column regional_intake jsonb/i);
  assert.match(sql, /career_revision\s*=\s*career_revision\s*\+/i);
  assert.match(sql, /p_expected_revision/i);
  assert.match(sql, /join public\.user_roles/i);
  assert.match(sql, /grant execute on function public\.apply_client_regional_intake_v1.*to service_role/is);
  assert.doesNotMatch(sql, /\b(drop table|truncate|delete from|auth\.users|storage\.objects)\b/i);
});

test("same-data comparator renders page PNGs, measures geometry and rejects missing facts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zevantaa-stage2-"));
  try {
    const profile = createLongGlobalAtsQaProfile();
    profile.fullName = "Rohan Kapoor";
    profile.workExperience = profile.workExperience.slice(0, 1);
    profile.education = profile.education.slice(0, 1);
    profile.skills = profile.skills.slice(0, 2);
    profile.certifications = []; profile.projects = []; profile.languages = [];
    profile.additionalSections = [];
    const original = join(directory, "original.pdf");
    await writeFile(original, await renderPdfDocument(buildGlobalAtsResumeModel(mapped(profile))));
    const manifest = join(directory, "same-data.json");
    await writeFile(manifest, JSON.stringify({ fixtureId: "fictional-test", outputKind: "global-ats-resume",
      masterPdf: original, generatedPdf: original,
      requiredFacts: ["Rohan Kapoor", "Fictional Lean", "Master of Business Administration"] }));
    // This fixture deliberately has no certification, so the precondition fails.
    const script = new URL("../scripts/compare-template-same-data.mjs", import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/iu, "");
    const rejected = spawnSync(process.execPath, [script, manifest, join(directory, "rejected")], { encoding: "utf8" });
    assert.equal(rejected.status, 1);
    const invalid = JSON.parse(await readFile(join(directory, "rejected", "comparison.json"), "utf8"));
    assert.equal(invalid.sameDataEvidence, false);
    const acceptedManifest = { ...JSON.parse(await readFile(manifest, "utf8")),
      requiredFacts: ["Rohan Kapoor", "Master of Business Administration", "Fictional Regional University"] };
    await writeFile(manifest, JSON.stringify(acceptedManifest));
    const accepted = spawnSync(process.execPath, [script, manifest, join(directory, "accepted")], { encoding: "utf8" });
    assert.equal(accepted.status, 0, accepted.stderr);
    const valid = JSON.parse(await readFile(join(directory, "accepted", "comparison.json"), "utf8"));
    assert.equal(valid.sameDataEvidence, true);
    assert.deepEqual(valid.pixelDifferenceByPage, valid.pixelDifferenceByPage.map(() => 0));
    assert.equal(valid.generatedOutsideTextItems, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
