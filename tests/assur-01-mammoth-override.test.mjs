import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import mammoth from "mammoth";
import { docxFixture } from "./fixtures/extraction-fixtures.mjs";

const require = createRequire(import.meta.url);

test("Mammoth resolves the pinned argparse override without vulnerable 1.x", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(manifest.overrides.argparse, "2.0.1");
  const mammothPath = require.resolve("mammoth/package.json");
  const mammothRequire = createRequire(mammothPath);
  const resolvedArgparse = mammothRequire.resolve("argparse/package.json");
  assert.equal(JSON.parse(readFileSync(resolvedArgparse, "utf8")).version, "2.0.1");
});

test("overridden dependency leaves DOCX paragraphs and table reading intact", async () => {
  const bytes = docxFixture({
    paragraphs: ["Fictional Candidate", "Professional Experience", "Operations Analyst at Imaginary Works"],
    tableRows: [["Skill", "Level"], ["Planning", "Experienced"]],
  });
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  for (const text of ["Fictional Candidate", "Professional Experience", "Operations Analyst", "Planning", "Experienced"]) {
    assert.ok(result.value.includes(text), text);
  }
  assert.ok(result.value.indexOf("Fictional Candidate") < result.value.indexOf("Operations Analyst"));
});
