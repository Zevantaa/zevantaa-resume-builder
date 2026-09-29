import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { docxFixture, legacyDocFixture, pdfFixture } from "./fixtures/extraction-fixtures.mjs";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {}", shortCircuit: true };
    }
    if (specifier === "@/features/client-portal/intake-file-validation") {
      return nextResolve(new URL("../src/features/client-portal/intake-file-validation.ts", import.meta.url).href, context);
    }
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { extractResumeTextFromBytes: extract } = await import("../src/features/document-generation/extract-resume-text.ts");
const { normalizeExtractedText: normalize } = await import("../src/features/document-generation/normalize-extracted-text.ts");
const MIME = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
const source = (extension, bytes, overrides = {}) => ({
  sourceFileId: "fictional-source-id",
  sourceMimeType: MIME[extension],
  sourceExtension: extension,
  bytes,
  ...overrides,
});

test("DOC-02-01 extracts a real synthetic OLE DOC in memory", async () => {
  const result = await extract(source("doc", legacyDocFixture()));
  assert.equal(result.status, "success");
  assert.equal(result.extractor, "word-extractor");
  assert.match(result.normalizedText, /This line gets read fine/);
  assert.equal(result.sourceFileId, "fictional-source-id");
  assert.equal(result.pageCount, null);
});

test("malformed DOC returns a structured failure, never empty success", async () => {
  const result = await extract(source("doc", Buffer.from("not an OLE document")));
  assert.equal(result.status, "failed");
  assert.equal(result.failureReason, "invalid-file");
  assert.equal(result.normalizedText, null);
});

test("DOC-02-02 extracts DOCX paragraphs in reading order", async () => {
  const result = await extract(source("docx", docxFixture({ paragraphs: [
    "Fictional candidate profile", "Worked at Imaginary Harbour Services", "Documented safe processes",
  ] })));
  assert.equal(result.status, "success");
  assert.equal(result.extractor, "mammoth");
  assert.ok(result.normalizedText.indexOf("Fictional candidate") < result.normalizedText.indexOf("Imaginary Harbour"));
  assert.ok(result.normalizedText.indexOf("Imaginary Harbour") < result.normalizedText.indexOf("Documented safe"));
});

test("DOCX table cells are extracted in row order", async () => {
  const result = await extract(source("docx", docxFixture({
    paragraphs: ["Fictional work experience"],
    tableRows: [["Role", "Employer"], ["Analyst", "Imaginary Blue Kite Services"]],
  })));
  assert.equal(result.status, "success");
  for (const term of ["Role", "Employer", "Analyst", "Imaginary Blue Kite Services"]) {
    assert.ok(result.normalizedText.includes(term));
  }
  assert.ok(result.normalizedText.indexOf("Role") < result.normalizedText.indexOf("Analyst"));
});

test("malformed DOCX and macro-bearing DOCX fail safely", async () => {
  const malformed = await extract(source("docx", docxFixture({ malformed: true })));
  assert.equal(malformed.status, "failed");
  assert.equal(malformed.failureReason, "corrupt-file");
  const macro = await extract(source("docx", docxFixture({ paragraphs: ["Fictional candidate profile"], macro: true })));
  assert.equal(macro.status, "unsupported");
  assert.equal(macro.failureReason, "active-content");
});

test("DOC-02-03 extracts text from a PDF", async () => {
  const result = await extract(source("pdf", pdfFixture(["Fictional candidate with relevant work history and practical skills."])));
  assert.equal(result.status, "success");
  assert.equal(result.extractor, "pdfjs-dist");
  assert.equal(result.pageCount, 1);
  assert.match(result.normalizedText, /Fictional candidate/);
});

test("multi-page PDF preserves page order and a readable boundary", async () => {
  const result = await extract(source("pdf", pdfFixture([
    "First page: fictional work experience at Imaginary Harbour.",
    "Second page: fictional education and relevant skills.",
  ])));
  assert.equal(result.status, "success");
  assert.equal(result.pageCount, 2);
  assert.match(result.rawText, /\f/);
  assert.ok(result.normalizedText.indexOf("First page") < result.normalizedText.indexOf("Second page"));
  assert.match(result.normalizedText, /Harbour\.\n\nSecond page/);
});

test("image-only PDF reports insufficient text without OCR", async () => {
  const result = await extract(source("pdf", pdfFixture([""], { imageOnly: true })));
  assert.equal(result.status, "insufficient-text");
  assert.equal(result.failureReason, "insufficient-text");
  assert.equal(result.pageCount, 1);
  assert.equal(result.normalizedText, "");
});

test("encrypted PDF returns a structured unsupported result", async () => {
  const result = await extract(source("pdf", pdfFixture([
    "Fictional candidate with work experience and relevant skills.",
  ], { encrypted: true })));
  assert.equal(result.status, "unsupported");
  assert.equal(result.failureReason, "encrypted-file");
  assert.equal(result.normalizedText, null);
});

test("malformed PDF and extension/MIME mismatch are rejected", async () => {
  const malformed = await extract(source("pdf", Buffer.from("%PDF-1.4 broken")));
  assert.equal(malformed.status, "failed");
  assert.equal(malformed.failureReason, "invalid-file");
  const mismatch = await extract(source("docx", docxFixture({ paragraphs: ["Fictional profile"] }), {
    sourceMimeType: "application/pdf",
  }));
  assert.equal(mismatch.status, "unsupported");
  assert.equal(mismatch.failureReason, "unsupported-format");
});

test("DOC-02-04 normalizes parser noise without losing bullets or section boundaries", () => {
  assert.equal(normalize("  SUMMARY\r\n\r\n\r\n\t•  Fictional  role\f\fSKILLS\r-  Reporting\u0000\u0007"),
    "SUMMARY\n\n• Fictional role\n\nSKILLS\n- Reporting");
});
