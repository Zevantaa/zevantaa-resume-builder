import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: "data:text/javascript,export async function requireApplicationRole(role){return globalThis.__pdfQaRequireRole(role)}",
    shortCircuit: true,
  };
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { createPdfRenderQaModel } = await import("../src/features/document-generation/pdf/pdf-render-qa-fixtures.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { generatePdfForQaAction } = await import("../src/features/document-generation/pdf/generate-pdf-for-qa-action.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function inspect(buffer) {
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push({ width: page.view[2], height: page.view[3], items: content.items.filter((item) => "str" in item),
        text: content.items.map((item) => item.str ?? "").join(" ") });
    }
  } finally { await task.destroy(); }
  return pages;
}

test("QA fixtures render one-page, multi-page, and selectable Unicode PDFs", async () => {
  const one = await inspect(await renderPdfDocument(createPdfRenderQaModel("one-page")));
  assert.equal(one.length, 1);
  assert.match(one[0].text, /Rohan Kapoor/);
  assert.match(one[0].text, /Operations & Supply Chain Professional/);
  assert.match(one[0].text, /Education/);

  const multi = await inspect(await renderPdfDocument(createPdfRenderQaModel("multi-page")));
  assert.ok(multi.length >= 3);
  assert.match(multi.map((page) => page.text).join(" "), /Long supplied bullet 13/);
  const breakPage = multi.findIndex((page) => page.text.includes("This supplied QA paragraph starts after an explicit page break"));
  assert.ok(breakPage > 0);
  assert.ok(!multi[breakPage - 1].text.includes("This supplied QA paragraph starts after an explicit page break"));
  for (const page of multi) for (const item of page.items) {
    if (!item.str) continue;
    assert.ok(item.transform[4] >= 15 && item.transform[4] + item.width <= page.width - 15);
    assert.ok(item.transform[5] >= 15 && item.transform[5] <= page.height - 15);
  }

  const unicode = await inspect(await renderPdfDocument(createPdfRenderQaModel("unicode")));
  assert.equal(unicode.length, 1);
  assert.match(unicode[0].text, /Rohan Kapoor/);
  assert.match(unicode[0].text, /Operations & Supply Chain/);
  assert.match(unicode[0].text, /रोहन/);
});

test("QA generation rechecks admin access and accepts only fixed scenario names", async () => {
  globalThis.__pdfQaRequireRole = async (role) => {
    assert.equal(role, "admin");
    throw new Error("ADMIN_ONLY");
  };
  await assert.rejects(() => generatePdfForQaAction("one-page"), /ADMIN_ONLY/);

  globalThis.__pdfQaRequireRole = async (role) => assert.equal(role, "admin");
  await assert.rejects(() => generatePdfForQaAction("other"), /Unsupported PDF QA scenario/);
  const generated = await generatePdfForQaAction("one-page");
  assert.equal(generated.filename, "development-qa-one-page.pdf");
  assert.equal(Buffer.from(generated.base64, "base64").subarray(0, 5).toString(), "%PDF-");
});

test("QA route stays out of normal admin navigation and uses no persisted/public PDF path", () => {
  const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
  assert.doesNotMatch(read("src/app/admin/layout.tsx"), /pdf-render-test/);
  assert.match(read("src/app/admin/layout.tsx"), /requireApplicationRole\("admin"\)/);
  assert.match(read("src/features/document-generation/pdf/generate-pdf-for-qa-action.ts"), /requireApplicationRole\("admin"\)/);
  assert.match(read("src/features/document-generation/pdf/pdf-render-qa-panel.tsx"), /URL\.createObjectURL/);
  assert.doesNotMatch(read("src/features/document-generation/pdf/generate-pdf-for-qa-action.ts"), /SUPABASE_SECRET_KEY|service_role|storage\.from|\.from\("document_records"\)/);
});
