import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

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
const { createGccQaProfile } = await import("../src/features/document-generation/gcc-qa-fixture.ts");
const { createEuropeanQaProfile } = await import("../src/features/document-generation/european-qa-fixture.ts");
const { createCoverLetterQaProfile } = await import("../src/features/document-generation/cover-letter-qa-fixture.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildDomesticResumeModel, DOMESTIC_DESIGNS } = await import("../src/features/document-generation/domestic-resumes.ts");
const { buildGlobalAtsResumeModel } = await import("../src/features/document-generation/global-ats-resume.ts");
const { buildGccResumeModel } = await import("../src/features/document-generation/gcc-resume.ts");
const { buildEuropeanResumeModel } = await import("../src/features/document-generation/european-resume.ts");
const { buildCoverLetterModel } = await import("../src/features/document-generation/cover-letters.ts");

const mapResume = (profile) => mapCandidateProfileToDocumentData(profile, "resume");
const flattenBlocks = (blocks) => blocks.flatMap((block) => block.kind === "columns"
  ? [block, ...flattenBlocks(block.left), ...flattenBlocks(block.right)] : [block]);
const allBlocks = (model) => flattenBlocks(model.sections.flatMap((section) => section.blocks));

test("reference reconciliation records all ten supplied pairs and the missing technology target", () => {
  const inventory = readFileSync(new URL("../docs/DESIGN_REFERENCE_INVENTORY.md", import.meta.url), "utf8");
  assert.equal((inventory.match(/\| Matched \|/gu) ?? []).length, 10);
  assert.match(inventory, /technology-startup-cover-letter.*Not supplied.*Not supplied.*Missing/is);
  assert.match(inventory, /exactly 20 files: 10 HTML files and 10 PDF files/i);
  assert.match(inventory, /no byte-identical duplicates/i);
});

test("five domestic output IDs route to the five approved premium compositions", () => {
  const mapping = mapResume(createLongGlobalAtsQaProfile());
  const outputs = DOMESTIC_DESIGNS.map((design) => buildDomesticResumeModel(mapping, design.id));
  assert.deepEqual(DOMESTIC_DESIGNS.map((design) => design.name), [
    "Royal Navy & Gold Boardroom", "Contemporary Executive Sidebar", "Editorial Prestige Masthead",
    "Split-Grid Executive", "Executive Gold Accent",
  ]);
  assert.deepEqual(outputs.map((output) => allBlocks(output.model).find((block) => block.kind === "premium-identity")?.style),
    ["boardroom", "executive-sidebar", "editorial-masthead", undefined, "gold-accent"]);
  assert.equal(allBlocks(outputs[1].model).find((block) => block.kind === "columns")?.variant, "sidebar");
  assert.equal(allBlocks(outputs[3].model).find((block) => block.kind === "columns")?.variant, "split-grid");
  for (const [index, output] of outputs.entries()) {
    assert.ok(allBlocks(output.model).some((block) => block.kind === "competency-grid") || index === 3);
  }
});

test("regional and global targets use premium identities without adding candidate fields", () => {
  const global = buildGlobalAtsResumeModel(mapResume(createLongGlobalAtsQaProfile()));
  assert.equal(allBlocks(global)[0].kind, "premium-identity");
  assert.equal(allBlocks(global)[0].style, "global-ats");

  const gcc = buildGccResumeModel(mapResume(createGccQaProfile()));
  assert.equal(allBlocks(gcc.model)[0].kind, "gcc-identity");
  assert.ok(!JSON.stringify(gcc.model).match(/nationality|visa status|work rights/i));

  const european = buildEuropeanResumeModel(mapResume(createEuropeanQaProfile()));
  assert.equal(allBlocks(european.model)[0].kind, "european-identity");
  assert.ok(!JSON.stringify(european.model).match(/nationality|visa status|work rights|CEFR/i));
});

test("approved letters use premium headers while missing Technology reference keeps the prior layout", () => {
  const mapping = mapCandidateProfileToDocumentData(createCoverLetterQaProfile(), "cover-letter");
  const corporate = buildCoverLetterModel(mapping, "general-corporate");
  const relocation = buildCoverLetterModel(mapping, "international-relocation");
  const technology = buildCoverLetterModel(mapping, "technology-startup");
  for (const output of [corporate, relocation]) {
    assert.equal(output.model.sections[0].blocks[0].kind, "premium-identity");
    assert.ok(!output.model.sections[0].blocks.some((block) => block.kind === "competency-grid"));
  }
  assert.equal(technology.model.sections[0].blocks[0].kind, "heading");
  assert.ok(!technology.model.sections[0].blocks.some((block) => block.kind === "premium-identity"));
  assert.ok(technology.model.sections[0].blocks.some((block) => block.kind === "heading" &&
    block.text === "Re: Technology & Startup Opportunity"));
});
