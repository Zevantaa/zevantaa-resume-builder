import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { resolvePdfTheme } = await import("../src/features/document-generation/pdf/pdf-theme.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const model = (sections) => ({ sourceProfileId: "00000000-0000-4000-8000-000000000001", title: "Fictional PDF QA", sections });
async function inspect(buffer) {
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buffer.length > 1000);
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push({ page, items: content.items.filter((item) => "str" in item && item.str) });
    }
    return pages.map(({ page, items }) => ({ width: page.view[2], height: page.view[3], items,
      text: items.map((item) => item.str).join(" ") }));
  } finally { await task.destroy(); }
}

test("A4 one-page PDF contains selectable supplied text, Unicode, contacts and links", async () => {
  const pages = await inspect(await renderPdfDocument(model([{ id: "intro", blocks: [
    { kind: "heading", text: "José Álvarez भारत", level: 1 },
    { kind: "contact-row", items: [{ text: "jose@example.invalid", href: "mailto:jose@example.invalid" },
      { text: "https://example.invalid/a/very/long/profile/link", href: "https://example.invalid/a/very/long/profile/link" }] },
    { kind: "paragraph", text: "Candidate-supplied summary only." },
  ] }])));
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /José/);
  assert.match(pages[0].text, /Candidate-supplied summary/);
  assert.match(pages[0].text, /भारत/);
  assert.ok(pages[0].items.length > 0);
  for (const item of pages[0].items) assert.ok(item.transform[4] + item.width <= pages[0].width - 15);
});

test("same structured input produces byte-identical PDF output", async () => {
  const input = model([{ id: "deterministic", blocks: [{ kind: "paragraph", text: "Supplied deterministic content." }] }]);
  const first = await renderPdfDocument(input);
  const second = await renderPdfDocument(input);
  assert.ok(first.equals(second));
});

test("empty optional sections are omitted and source section order stays deterministic", async () => {
  const pages = await inspect(await renderPdfDocument(model([
    { id: "empty", title: "EMPTY HEADING", blocks: [{ kind: "paragraph", text: "  " }, { kind: "bullets", items: [] }] },
    { id: "first", title: "FIRST SECTION", blocks: [{ kind: "paragraph", text: "First supplied value" }] },
    { id: "second", title: "SECOND SECTION", blocks: [{ kind: "paragraph", text: "Second supplied value" }] },
  ])));
  const text = pages.map((page) => page.text).join(" ");
  assert.doesNotMatch(text, /EMPTY HEADING/);
  assert.ok(text.indexOf("FIRST SECTION") < text.indexOf("SECOND SECTION"));
});

test("explicit page break creates a second page", async () => {
  const pages = await inspect(await renderPdfDocument(model([{ id: "split", blocks: [
    { kind: "paragraph", text: "Before break" }, { kind: "page-break" },
    { kind: "paragraph", text: "After break" },
  ] }])));
  assert.equal(pages.length, 2);
  assert.match(pages[0].text, /Before break/);
  assert.match(pages[1].text, /After break/);
});

test("long entries and wrapped bullets naturally flow across at least three pages without lost text", async () => {
  const longBullet = "Detailed supplied responsibility with Unicode café and operational evidence. ".repeat(9);
  const entries = Array.from({ length: 14 }, (_, n) => ({ kind: "entry", title: `Fictional role ${n + 1}`,
    date: "2020-01 to 2022-12", description: `Supplied employer narrative ${n + 1}.`,
    bullets: [longBullet, `Unique supplied marker ${n + 1}`] }));
  const pages = await inspect(await renderPdfDocument(model([{ id: "work", title: "Employment", blocks: entries }])));
  assert.ok(pages.length >= 3);
  const content = pages.map((page) => page.text).join(" ");
  assert.match(content, /Fictional role 1/);
  assert.match(content, /Unique supplied marker 14/);
  assert.match(content, /Detailed supplied responsibility/);
  for (const page of pages) for (const item of page.items) {
    assert.ok(item.transform[5] >= 15 && item.transform[5] <= page.height - 15, "Text stays on the physical page.");
  }
});

test("short entries keep heading and first bullet together; typography and margins are configurable", async () => {
  const theme = resolvePdfTheme({ margins: { left: 62, top: 62 }, typography: { bodySize: 11, sectionGap: 18 } });
  assert.equal(theme.margins.left, 62);
  assert.equal(theme.typography.bodySize, 11);
  assert.throws(() => resolvePdfTheme({ margins: { left: 300 } }), RangeError);
  const filler = Array.from({ length: 22 }, (_, n) => ({ kind: "paragraph", text: `Filler line ${n + 1}: supplied context of moderate length.` }));
  const pages = await inspect(await renderPdfDocument(model([{ id: "flow", blocks: [
    ...filler, { kind: "entry", title: "Short reviewed role", bullets: ["First reviewed achievement."] },
  ] }]), { margins: { left: 62, top: 62 }, typography: { bodySize: 11, sectionGap: 18 } }));
  const titlePage = pages.findIndex((page) => page.text.includes("Short reviewed role"));
  const bulletPage = pages.findIndex((page) => page.text.includes("First reviewed achievement"));
  assert.equal(titlePage, bulletPage);
  for (const page of pages) for (const item of page.items) assert.ok(item.transform[4] >= 50);
});

test("long supplied names, employer lines and URLs stay within A4 bounds", async () => {
  const longName = "Alexandra Fictional-Candidate ".repeat(9).trim();
  const longEmployer = "Fictional International Operations and Technology Cooperative ".repeat(8).trim();
  const longUrl = `https://example.invalid/profile/${"candidate-review-segment/".repeat(12)}`;
  const pages = await inspect(await renderPdfDocument(model([{ id: "long-fields", blocks: [
    { kind: "heading", text: longName, level: 1 },
    { kind: "contact-row", items: [{ text: longUrl, href: longUrl }] },
    { kind: "entry", title: "Senior Operations Manager", subtitle: longEmployer,
      bullets: ["A long but entirely supplied professional achievement. ".repeat(12)] },
  ] }])));
  const content = pages.map((page) => page.text).join(" ");
  assert.match(content, /Fictional-Candidate/);
  assert.match(content, /Fictional International Operations/);
  assert.match(content, /candidate-review-segment/);
  for (const page of pages) for (const item of page.items) {
    assert.ok(item.transform[4] >= 15);
    assert.ok(item.transform[4] + item.width <= page.width - 15,
      `Long text stays within the page width: ${item.str} at ${item.transform[4]} + ${item.width} / ${page.width}.`);
    assert.ok(item.transform[5] >= 15 && item.transform[5] <= page.height - 15);
  }
});
