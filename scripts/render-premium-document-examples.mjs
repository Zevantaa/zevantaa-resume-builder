import { mkdir, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/features/document-generation/")) {
    return nextResolve(new URL(`../src/features/document-generation/${specifier.slice("@/features/document-generation/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") &&
      !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { createGccQaProfile, createGccQaPhotoDataUri } = await import("../src/features/document-generation/gcc-qa-fixture.ts");
const { createEuropeanQaProfile } = await import("../src/features/document-generation/european-qa-fixture.ts");
const { createCoverLetterQaProfile } = await import("../src/features/document-generation/cover-letter-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildGlobalAtsResumeModel } = await import("../src/features/document-generation/global-ats-resume.ts");
const { buildDomesticResumeModel } = await import("../src/features/document-generation/domestic-resumes.ts");
const { buildGccResumeModel } = await import("../src/features/document-generation/gcc-resume.ts");
const { buildEuropeanResumeModel } = await import("../src/features/document-generation/european-resume.ts");
const { buildCoverLetterModel } = await import("../src/features/document-generation/cover-letters.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");

function mediumExecutiveProfile() {
  const profile = createLongGlobalAtsQaProfile();
  profile.professionalSummary = "Fictional QA profile demonstrating verified operations planning, service coordination, reporting, and cross-functional delivery experience.";
  profile.workExperience = profile.workExperience.slice(0, 2).map((item) => ({ ...item, highlights: item.highlights.slice(0, 2) }));
  profile.education = profile.education.slice(0, 1);
  profile.skills = profile.skills.slice(0, 6);
  profile.certifications = profile.certifications.slice(0, 1);
  profile.projects = profile.projects.slice(0, 1);
  profile.languages = profile.languages.slice(0, 2);
  profile.additionalSections = profile.additionalSections.slice(0, 1);
  return profile;
}

const outputDirectory = path.resolve("output", "pdf", "milestone-3");
await mkdir(outputDirectory, { recursive: true });
const executiveMapping = mapCandidateProfileToDocumentData(mediumExecutiveProfile(), "resume");
const examples = [
  ["01-global-ats-resume.pdf", { model: buildGlobalAtsResumeModel(executiveMapping), theme: {} }],
  ...(["1", "2", "3", "4", "5"].map((design, index) =>
    [`0${index + 2}-domestic-${design}.pdf`, buildDomesticResumeModel(executiveMapping, design)])),
  ["07-gcc-regional-resume.pdf", buildGccResumeModel(
    mapCandidateProfileToDocumentData(createGccQaProfile(), "resume"), await createGccQaPhotoDataUri())],
  ["08-europass-european-resume.pdf", buildEuropeanResumeModel(
    mapCandidateProfileToDocumentData(createEuropeanQaProfile(), "resume"))],
];
const letterMapping = mapCandidateProfileToDocumentData(createCoverLetterQaProfile(), "cover-letter");
examples.push(
  ["09-general-corporate-cover-letter.pdf", buildCoverLetterModel(letterMapping, "general-corporate")],
  ["10-international-relocation-cover-letter.pdf", buildCoverLetterModel(letterMapping, "international-relocation")],
  ["11-technology-startup-cover-letter-existing-design.pdf", buildCoverLetterModel(letterMapping, "technology-startup")],
);

for (const [filename, output] of examples) {
  const bytes = await renderPdfDocument(output.model, output.theme);
  await writeFile(path.join(outputDirectory, filename), bytes, { flag: "w" });
  process.stdout.write(`${filename}\t${bytes.length}\n`);
}
