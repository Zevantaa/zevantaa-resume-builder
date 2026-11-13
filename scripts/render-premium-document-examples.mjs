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

const scenarioNames = ["short", "normal", "extensive", "edge"];
const outputRoot = path.resolve("output", "pdf", "milestone-3.1-after");
const photoDataUri = await createGccQaPhotoDataUri();

function normalExecutiveProfile() {
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

function shortProfile(profile) {
  const value = structuredClone(profile);
  value.fullName = "Rohan Kapoor";
  value.primaryEmail = "rohan.qa@example.invalid";
  value.linkedinUrl = "https://www.linkedin.com/in/fictional-rohan-kapoor";
  value.currentLocation = "Fictional Chandigarh";
  value.professionalSummary = "Fictional operations professional with verified experience in planning, reporting, and team coordination.";
  value.workExperience = value.workExperience.slice(0, 1).map((item) => ({ ...item,
    jobTitle: "Operations Manager", employerName: "Fictional Distribution Group",
    location: "Fictional Chandigarh", description: "Coordinated planning and reporting activities across service teams.",
    highlights: ["Documented weekly handoffs across inventory, reporting, and service teams."],
  }));
  value.education = value.education.slice(0, 1);
  value.skills = value.skills.slice(0, 4);
  value.certifications = value.certifications.slice(0, 1);
  value.projects = [];
  value.languages = value.languages.slice(0, 2);
  value.additionalSections = [];
  return value;
}

function edgeProfile(profile) {
  const value = structuredClone(profile);
  value.fullName = "Anne-Marie O'Neill-Sánchez Fictional International Transformation and Operations Leadership Candidate";
  value.primaryEmail = "anne-marie.oneill-sanchez.international.operations.qa@example.invalid";
  value.linkedinUrl = "https://www.linkedin.com/in/fictional-anne-marie-oneill-sanchez-international-operations-transformation-supply-chain-programme-leadership";
  value.currentLocation = "Fictional North-West Regional Operations, Distribution and Cross-Border Coordination Centre";
  value.professionalSummary = "Fictional QA profile with verified cross-functional planning, reporting, service delivery, and programme coordination experience across several operational teams.";
  value.workExperience = value.workExperience.slice(0, 3).map((item, index) => ({ ...item,
    jobTitle: `Senior International Operations, Supply Chain and Cross-Functional Programme Coordination Manager ${index + 1}`,
    highlights: item.highlights.slice(0, 2),
  }));
  value.skills = value.skills.slice(0, 12);
  value.certifications = value.certifications.slice(0, 2);
  return value;
}

function scenarioProfile(base, scenario) {
  if (scenario === "short") return shortProfile(base);
  if (scenario === "edge") return edgeProfile(base);
  return structuredClone(base);
}

for (const scenario of scenarioNames) {
  const outputDirectory = path.join(outputRoot, scenario);
  await mkdir(outputDirectory, { recursive: true });

  const executiveBase = scenario === "normal" ? normalExecutiveProfile() : createLongGlobalAtsQaProfile();
  const executiveMapping = mapCandidateProfileToDocumentData(scenarioProfile(executiveBase, scenario), "resume");
  const gccMapping = mapCandidateProfileToDocumentData(
    scenarioProfile(createGccQaProfile(scenario === "extensive"), scenario), "resume");
  const europeanMapping = mapCandidateProfileToDocumentData(
    scenarioProfile(createEuropeanQaProfile(scenario === "extensive"), scenario), "resume");

  const letterBase = createCoverLetterQaProfile();
  if (scenario === "extensive") {
    const source = createLongGlobalAtsQaProfile();
    letterBase.workExperience = source.workExperience;
    letterBase.education = source.education;
    letterBase.skills = source.skills;
    letterBase.certifications = source.certifications;
    letterBase.projects = source.projects;
    letterBase.languages = source.languages;
    letterBase.additionalSections = source.additionalSections;
  }
  const letterMapping = mapCandidateProfileToDocumentData(scenarioProfile(letterBase, scenario), "cover-letter");

  const examples = [
    ["01-global-ats-resume.pdf", { model: buildGlobalAtsResumeModel(executiveMapping), theme: {} }],
    ...(["1", "2", "3", "4", "5"].map((design, index) =>
      [`0${index + 2}-domestic-${design}.pdf`, buildDomesticResumeModel(executiveMapping, design)])),
    ["07-gcc-regional-resume.pdf", buildGccResumeModel(gccMapping, photoDataUri)],
    ["08-europass-european-resume.pdf", buildEuropeanResumeModel(europeanMapping)],
    ["09-general-corporate-cover-letter.pdf", buildCoverLetterModel(letterMapping, "general-corporate")],
    ["10-international-relocation-cover-letter.pdf", buildCoverLetterModel(letterMapping, "international-relocation")],
    ["11-technology-startup-cover-letter-existing-design.pdf", buildCoverLetterModel(letterMapping, "technology-startup")],
  ];

  for (const [filename, output] of examples) {
    const bytes = await renderPdfDocument(output.model, output.theme);
    await writeFile(path.join(outputDirectory, filename), bytes, { flag: "w" });
    process.stdout.write(`${scenario}\t${filename}\t${bytes.length}\n`);
  }
}
