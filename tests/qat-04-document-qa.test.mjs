import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildGlobalAtsResumeModel } = await import("../src/features/document-generation/global-ats-resume.ts");
const { buildDomesticResumeModel, DOMESTIC_DESIGNS } = await import("../src/features/document-generation/domestic-resumes.ts");
const { buildGccResumeModel } = await import("../src/features/document-generation/gcc-resume.ts");
const { createGccQaPhotoDataUri } = await import("../src/features/document-generation/gcc-qa-fixture.ts");
const { buildEuropeanResumeModel } = await import("../src/features/document-generation/european-resume.ts");
const { buildCoverLetterModel, COVER_LETTER_TYPES } = await import("../src/features/document-generation/cover-letters.ts");
const { buildPrivacyMaskedEmployerResume, createCandidateReferenceId } = await import("../src/features/document-generation/privacy-masked-resume.ts");
const { buildPdfFilename, sanitizePdfDownloadFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { getAllowedOutputsForPackage, V1_DOCUMENT_OUTPUTS } = await import("../src/features/document-generation/package-routing.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function complete() {
  const profile = createLongGlobalAtsQaProfile();
  profile.selectedPackage = "executive-transition-agency-distribution";
  profile.targetMarkets = ["indian-domestic", "gcc-middle-east", "european-union"];
  profile.professionalSummary = "Fictional operations professional with supplied experience in planning, reporting, and cross-functional handoffs.";
  profile.workExperience = profile.workExperience.slice(1, 6).map((role) => ({ ...role, highlights: role.highlights.slice(0, 2) }));
  profile.skills = profile.skills.slice(0, 20);
  return profile;
}
function sparse() {
  const profile = complete();
  profile.professionalSummary = undefined;
  profile.workExperience = []; profile.education = []; profile.skills = profile.skills.slice(0, 1);
  profile.certifications = []; profile.projects = []; profile.languages = []; profile.additionalSections = [];
  profile.linkedinUrl = undefined; profile.whatsappNumber = undefined; profile.currentLocation = "";
  profile.relocationPreference = "not-specified";
  return profile;
}
function stress() {
  const profile = createLongGlobalAtsQaProfile();
  profile.selectedPackage = "executive-transition-agency-distribution";
  profile.targetMarkets = ["indian-domestic", "gcc-middle-east", "european-union"];
  profile.workExperience.push(...profile.workExperience.slice(0, 2).map((role, index) => ({
    ...role, id: `00000000-0000-4000-8000-${String(210 + index).padStart(12, "0")}`,
    sortOrder: 16 + index, jobTitle: `Additional fictional stress role ${index + 7}`,
  })));
  profile.education.push({ ...profile.education[0], id: "00000000-0000-4000-8000-000000000220",
    sortOrder: 32, qualification: "Fictional Advanced Operations Diploma" });
  profile.certifications.push(...profile.certifications.map((item, index) => ({ ...item,
    id: `00000000-0000-4000-8000-${String(230 + index).padStart(12, "0")}`,
    sortOrder: 72 + index, name: `Fictional Additional Certificate ${index + 1}` })));
  profile.projects.push(...[1, 2].map((index) => ({ ...profile.projects[0],
    id: `00000000-0000-4000-8000-${String(240 + index).padStart(12, "0")}`,
    sortOrder: 80 + index, name: `Fictional Additional Project ${index}` })));
  return profile;
}
function special() {
  const profile = complete();
  profile.fullName = "Anne-Marie O'Neill-Sánchez";
  profile.primaryEmail = "anne-marie.qa@example.invalid";
  profile.professionalSummary = "Candidate-supplied coordination across research & logistics teams in Montréal.";
  profile.workExperience[0] = { ...profile.workExperience[0], employerName: "Fictional Research & Logistics Cooperative" };
  return profile;
}

async function inspect(buffer) {
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str.trim());
      pages.push({ text: items.map((item) => item.str).join(" "), items,
        width: page.view[2], height: page.view[3], annotations: await page.getAnnotations() });
    }
    return { pages, metadata: await pdf.getMetadata() };
  } finally { await task.destroy(); }
}
const textOf = (pages) => pages.map((page) => page.text).join(" ");
const containsText = (haystack, needle) => haystack.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase("en")
  .includes(needle.normalize("NFKC").replace(/\s+/gu, "").toLocaleLowerCase("en"));
function assertNoArtifacts(text) {
  assert.doesNotMatch(text, /\b(?:undefined|null|N\/A)\b|\[object Object\]|\b(?:candidate_profile_id|sort_order|sourceProfileId)\b/i);
  assert.doesNotMatch(text, /\|\s*\||,\s*,/);
}
function assertPageBounds(pages, output) {
  for (const [index, page] of pages.entries()) {
    assert.ok(Math.abs(page.width - 595.28) < 1 && Math.abs(page.height - 841.89) < 1, `${output} page ${index + 1} not A4`);
    assert.ok(page.items.length > 1, `${output} page ${index + 1} unexpectedly blank`);
    for (const item of page.items) {
      const x = item.transform[4]; const y = item.transform[5];
      assert.ok(x >= 12 && x + item.width <= page.width - 12, `${output} page ${index + 1} horizontal clipping: ${item.str}`);
      assert.ok(y >= 12 && y <= page.height - 12, `${output} page ${index + 1} vertical clipping: ${item.str}`);
    }
    for (let first = 0; first < page.items.length; first += 1) for (let second = first + 1; second < page.items.length; second += 1) {
      const a = page.items[first]; const b = page.items[second];
      if (Math.abs(a.transform[5] - b.transform[5]) >= 1.5) continue;
      const overlap = Math.min(a.transform[4] + a.width, b.transform[4] + b.width) - Math.max(a.transform[4], b.transform[4]);
      assert.ok(overlap < 2, `${output} page ${index + 1} text collision: ${a.str} / ${b.str}`);
    }
  }
}

const resumes = [
  { id: "global-ats-resume", build: (mapping) => ({ model: buildGlobalAtsResumeModel(mapping), theme: {} }) },
  ...DOMESTIC_DESIGNS.map((design) => ({ id: `domestic-resume-${design.id}`,
    build: (mapping) => buildDomesticResumeModel(mapping, design.id) })),
  { id: "gcc-resume", build: (mapping) => buildGccResumeModel(mapping) },
  { id: "europass-eu-resume", build: (mapping) => buildEuropeanResumeModel(mapping) },
];

test("QAT-04 canonical mapping omits normalized duplicate skills but preserves first supplied wording and order", async () => {
  const profile = complete();
  profile.skills = [
    { ...profile.skills[0], name: "MS Excel", sortOrder: 2 },
    { ...profile.skills[1], name: "Microsoft Excel", sortOrder: 3 },
    { ...profile.skills[2], name: "Inventory planning", sortOrder: 4 },
  ];
  const mapped = mapCandidateProfileToDocumentData(profile, "resume");
  assert.deepEqual(mapped.data.skills.map((skill) => skill.name), ["MS Excel", "Inventory planning"]);
  assert.deepEqual(mapped.findings.filter((finding) => finding.code === "duplicate_skill").map((finding) => finding.severity), ["warning"]);
  const model = buildGlobalAtsResumeModel(mapped);
  assert.deepEqual(model.sections.find((section) => section.id === "skills").blocks[0].items, ["MS Excel", "Inventory planning"]);
  const rendered = textOf((await inspect(await renderPdfDocument(model))).pages);
  assert.equal((rendered.match(/MS Excel/gu) ?? []).length, 1);
  assert.doesNotMatch(rendered, /Microsoft Excel/);
});

test("QAT-04 frozen package routing grants only declared outputs", () => {
  assert.equal(V1_DOCUMENT_OUTPUTS.length, 11);
  const domestic = getAllowedOutputsForPackage("indian-domestic");
  const gcc = getAllowedOutputsForPackage("gcc-middle-east");
  const european = getAllowedOutputsForPackage("europass-european-union");
  const executive = getAllowedOutputsForPackage("executive-transition-agency-distribution");
  assert.deepEqual(domestic, V1_DOCUMENT_OUTPUTS.slice(0, 6));
  assert.deepEqual(gcc, ["global-ats-resume", "gcc-resume"]);
  assert.deepEqual(european, ["global-ats-resume", "europass-eu-resume"]);
  assert.deepEqual(executive, V1_DOCUMENT_OUTPUTS);
  assert.deepEqual(getAllowedOutputsForPackage("unknown"), []);
});

for (const output of resumes) {
  test(`QAT-04 ${output.id}: complete, sparse, stress and special-character PDFs preserve reviewed facts`, async (t) => {
    for (const [fixtureName, profile] of [["A complete", complete()], ["B sparse", sparse()],
      ["C stress", stress()], ["D special", special()]]) {
      const mapping = mapCandidateProfileToDocumentData(profile, "resume");
      assert.equal(mapping.canGenerate, true, `${output.id} ${fixtureName} map not ready`);
      const { model, theme } = output.build(mapping);
      const { pages } = await inspect(await renderPdfDocument(model, theme));
      const text = textOf(pages);
      assertPageBounds(pages, `${output.id} ${fixtureName}`);
      assertNoArtifacts(text);
      if (!containsText(text, profile.fullName)) t.diagnostic(`${output.id} extracted opening: ${text.slice(0, 300)}`);
      assert.ok(containsText(text, profile.fullName), `${output.id} ${fixtureName} missing name`);
      assert.ok(containsText(text, profile.primaryEmail), `${output.id} ${fixtureName} missing email`);
      assert.ok(containsText(text, profile.skills[0].name), `${output.id} ${fixtureName} missing skill`);
      if (fixtureName === "B sparse") {
        assert.doesNotMatch(text, /Professional Summary|Professional Profile|Professional Experience|Work Experience|Certifications|Projects|Languages|Additional Information|WhatsApp|linkedin\.com/);
      } else {
        for (const phrase of [profile.workExperience[0].jobTitle, profile.education[0].qualification,
          profile.certifications[0].name, profile.projects[0].name, profile.languages[0].name]) {
          if (!containsText(text, phrase)) t.diagnostic(`${output.id} missing fragment ${phrase}: ${text.slice(0, 650)}`);
          assert.ok(containsText(text, phrase), `${output.id} ${fixtureName} missing ${phrase}`);
        }
      }
      if (fixtureName === "C stress") {
        assert.ok(pages.length >= 3, `${output.id} stress should span 3+ pages`);
        assert.ok(containsText(text, "Additional fictional stress role 8"), `${output.id} missing role 8`);
        const heading = output.id === "europass-eu-resume" ? "Work Experience" : "Professional Experience";
        const headingPage = pages.findIndex((page) => containsText(page.text, heading));
        const rolePage = pages.findIndex((page) => containsText(page.text, profile.workExperience[0].jobTitle));
        assert.ok(headingPage >= 0 && rolePage >= 0, `${output.id} missing first experience opening`);
        assert.equal(headingPage, rolePage, `${output.id} orphaned the experience heading from the first role`);
      }
      if (fixtureName === "D special") {
        assert.ok(containsText(text, "O'Neill-Sánchez"), `${output.id} lost accented name`);
        assert.ok(containsText(text, "Research & Logistics"), `${output.id} lost ampersand`);
      }
      t.diagnostic(`${output.id} ${fixtureName}: ${pages.length} A4 page(s)`);
    }
  });
}

for (const type of COVER_LETTER_TYPES) {
  test(`QAT-04 ${type} cover letter: factual, searchable, concise and correctly signed`, async (t) => {
    for (const [fixtureName, profile] of [["A complete", complete()], ["D special", special()]]) {
      const mapping = mapCandidateProfileToDocumentData(profile, "cover-letter");
      const output = buildCoverLetterModel(mapping, type);
      const { pages } = await inspect(await renderPdfDocument(output.model, output.theme));
      const text = textOf(pages);
      assertPageBounds(pages, `${type} ${fixtureName}`);
      assertNoArtifacts(text);
      assert.ok(containsText(text, profile.fullName) && containsText(text, "Dear Hiring Manager,") && containsText(text, "Sincerely,"));
      if (!containsText(text, profile.workExperience.at(-1).jobTitle)) t.diagnostic(`${type} extracted opening: ${text.slice(0, 500)}`);
      assert.ok(containsText(text, profile.workExperience.at(-1).jobTitle));
      assert.doesNotMatch(text, /Candidate-supplied|\[Company Name\]|\[Recruiter\]|visa|sponsorship|work rights/i);
      assert.ok(pages.length <= 2, `${type} ${fixtureName} unexpectedly long`);
      t.diagnostic(`${type} ${fixtureName}: ${pages.length} page(s)`);
    }
  });
}

test("QAT-04 GCC photo is conditional; both variants remain searchable and within page bounds", async () => {
  const mapping = mapCandidateProfileToDocumentData(complete(), "resume");
  const noPhoto = buildGccResumeModel(mapping);
  const withPhoto = buildGccResumeModel(mapping, await createGccQaPhotoDataUri());
  const plainBytes = await renderPdfDocument(noPhoto.model, noPhoto.theme);
  const photoBytes = await renderPdfDocument(withPhoto.model, withPhoto.theme);
  const plain = await inspect(plainBytes); const photo = await inspect(photoBytes);
  assert.doesNotMatch(plainBytes.toString("latin1"), /\/Subtype\s*\/Image/);
  assert.match(photoBytes.toString("latin1"), /\/Subtype\s*\/Image/);
  for (const pages of [plain.pages, photo.pages]) {
    assertPageBounds(pages, "GCC photo variant");
    assert.ok(containsText(textOf(pages), mapping.data.identity.fullName));
    assert.ok(containsText(textOf(pages), mapping.data.employment[0].jobTitle));
  }
});

test("QAT-04 filename matrix covers all eleven outputs and a non-identifying masked export", () => {
  const expected = ["Global_ATS_Resume", "Domestic_Resume_1", "Domestic_Resume_2", "Domestic_Resume_3",
    "Domestic_Resume_4", "Domestic_Resume_5", "GCC_Resume", "Europass_EU_Resume",
    "General_Corporate_Cover_Letter", "International_Relocation_Cover_Letter", "Technology_Startup_Cover_Letter"];
  const ids = [...resumes.map((item) => item.id), ...COVER_LETTER_TYPES.map((type) => `${type}-cover-letter`)];
  assert.equal(ids.length, 11);
  for (const [index, id] of ids.entries()) {
    const name = buildPdfFilename({ candidateName: "Anne-Marie O'Neill-Sánchez\r\n../".repeat(10), output: id });
    assert.match(name, new RegExp(`_${expected[index]}\\.pdf$`));
    assert.ok(name.length <= 160 && !/[\\/\r\n\x00-\x1f]/.test(name), `${id} unsafe filename`);
    assert.equal(buildPdfFilename({ candidateName: "Rohan Kapoor", output: id }), buildPdfFilename({ candidateName: "Rohan Kapoor", output: id }));
    assert.match(sanitizePdfDownloadFilename(name), /\.pdf$/);
  }
  const reference = createCandidateReferenceId(complete().id);
  const masked = buildPdfFilename({ candidateName: reference, output: "global-ats-resume", privacyMasked: true });
  assert.match(masked, /^ZV_CAN_[A-F0-9]{20}_Global_ATS_Resume_Masked\.pdf$/);
  assert.doesNotMatch(masked, /Rohan|Kapoor|00000000-/);
});

test("QAT-04 privacy PDF masks direct contacts without changing the original mapping", async () => {
  const profile = complete();
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  const original = await inspect(await renderPdfDocument(buildGlobalAtsResumeModel(mapping)));
  const { model, referenceId } = buildPrivacyMaskedEmployerResume(mapping);
  const masked = await inspect(await renderPdfDocument(model));
  const originalText = textOf(original.pages); const maskedText = textOf(masked.pages);
  for (const direct of [profile.primaryEmail, profile.mobileNumber, profile.whatsappNumber,
    profile.linkedinUrl.replace(/^https?:\/\//, "")]) {
    assert.ok(originalText.replace(/\s+/gu, "").includes(direct.replace(/\s+/gu, "")), `original missing ${direct}`);
    assert.ok(!maskedText.replace(/\s+/gu, "").includes(direct.replace(/\s+/gu, "")), `masked leaked ${direct}`);
  }
  assert.ok(maskedText.includes(referenceId));
  assert.ok(maskedText.includes(profile.fullName));
  assert.ok(originalText.includes(profile.primaryEmail), "original changed by masking");
  assert.ok(!masked.pages.flatMap((page) => page.annotations).some((annotation) => /linkedin|@example\.invalid|tel:/i.test(annotation.url ?? "")));
  assert.doesNotMatch(JSON.stringify(masked.metadata.info), /@example\.invalid|linkedin\.com/i);
});

test("QAT-04 persisted profile loader excludes archived career rows before generation", () => {
  const service = read("src/features/document-generation/admin-global-ats-service.ts");
  for (const table of ["profile_work_experiences", "profile_education_entries", "profile_skills", "profile_certifications",
    "profile_languages", "profile_projects", "additional_profile_sections", "additional_profile_section_items"])
    assert.ok(service.includes(table), `loader missing ${table}`);
  assert.match(service, /archived_at/);
});
