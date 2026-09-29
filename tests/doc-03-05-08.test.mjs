import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: "data:text/javascript,export async function requireApplicationRole(role){return globalThis.__pdfDownloadQaRole(role)}",
    shortCircuit: true,
  };
  if (specifier.startsWith("@/features/document-generation/pdf/")) {
    return nextResolve(new URL(`../src/features/document-generation/pdf/${specifier.split("/").at(-1)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { buildPdfFilename, sanitizePdfDownloadFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { renderPdfDownloadResponse } = await import("../src/features/document-generation/pdf/pdf-download.ts");
const { createPdfRenderQaModel } = await import("../src/features/document-generation/pdf/pdf-render-qa-fixtures.ts");
const { POST } = await import("../src/app/admin/pdf-render-test/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const model = (sections, header, footer) => ({
  sourceProfileId: "00000000-0000-4000-8000-000000000003", title: "Fictional decoration QA",
  sections, ...(header ? { header } : {}), ...(footer ? { footer } : {}),
});

async function inspect(buffer) {
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str);
      pages.push({ width: page.view[2], height: page.view[3], items,
        text: items.map((item) => item.str).join(" ") });
    }
  } finally { await task.destroy(); }
  return pages;
}

test("optional header/footer are absent unless requested", async () => {
  const pages = await inspect(await renderPdfDocument(model([
    { id: "first", blocks: [{ kind: "paragraph", text: "Plain supplied body" }] },
  ])));
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /Plain supplied body/);
  assert.doesNotMatch(pages[0].text, /Page 1|QA HEADER|QA FOOTER/);
});

test("header/footer repeat on every page, number accurately, and reserve non-overlapping body space", async () => {
  const pages = await inspect(await renderPdfDocument(model([
    { id: "first", title: "First Section", blocks: [{ kind: "paragraph", text: "FIRST BODY MARKER" }] },
    { id: "second", breakBefore: true, title: "Second Section", blocks: [{ kind: "paragraph", text: "SECOND BODY MARKER" }] },
  ], { text: "QA HEADER", reference: "QA-REF", alignment: "right" },
  { text: "QA FOOTER", pageNumbers: "current-of-total", alignment: "center" })));
  assert.equal(pages.length, 2);
  for (const [index, page] of pages.entries()) {
    assert.match(page.text, /QA HEADER/);
    assert.match(page.text, /QA-REF/);
    assert.match(page.text, /QA FOOTER/);
    assert.match(page.text, new RegExp(`Page ${index + 1} of 2`));
    const header = page.items.find((item) => item.str.includes("QA HEADER"));
    const footer = page.items.find((item) => item.str.includes("QA FOOTER"));
    const body = page.items.find((item) => item.str.includes(index ? "SECOND BODY MARKER" : "FIRST BODY MARKER"));
    assert.ok(header && footer && body);
    assert.ok(header.transform[5] > body.transform[5] + 10, "Header clears the body.");
    assert.ok(footer.transform[5] + 10 < body.transform[5], "Footer clears the body.");
    for (const item of page.items) {
      assert.ok(item.transform[4] >= 15 && item.transform[4] + item.width <= page.width - 15);
      assert.ok(item.transform[5] >= 15 && item.transform[5] <= page.height - 15);
    }
  }
  assert.ok(pages[0].text.indexOf("FIRST BODY MARKER") >= 0);
  assert.ok(pages[1].text.indexOf("SECOND BODY MARKER") >= 0);
});

test("footer-only current page number and custom margins work", async () => {
  const pages = await inspect(await renderPdfDocument(model([
    { id: "body", blocks: [{ kind: "paragraph", text: "MARGIN BODY MARKER" }] },
  ], undefined, { reference: "FOOTER REF", pageNumbers: "current", alignment: "left" }),
  { margins: { top: 65, bottom: 65, left: 65, right: 65 } }));
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /FOOTER REF/);
  assert.match(pages[0].text, /Page 1/);
  assert.doesNotMatch(pages[0].text, /Page 1 of/);
  const body = pages[0].items.find((item) => item.str.includes("MARGIN BODY MARKER"));
  assert.ok(body.transform[4] >= 65);
});

test("section heading stays with its first paragraph near a page boundary", async () => {
  const filler = Array.from({ length: 25 }, (_, index) => ({ kind: "paragraph", text: `Supplied filler ${index + 1}: a medium-length line of factual QA text.` }));
  const pages = await inspect(await renderPdfDocument(model([
    { id: "filler", blocks: filler },
    { id: "kept", title: "KEEP SECTION HEADING", blocks: [{ kind: "paragraph", text: "FIRST KEPT BODY LINE" }] },
  ]), { typography: { bodySize: 11, paragraphGap: 8 } }));
  const headingPage = pages.findIndex((page) => page.text.includes("KEEP SECTION HEADING"));
  const bodyPage = pages.findIndex((page) => page.text.includes("FIRST KEPT BODY LINE"));
  assert.ok(headingPage >= 0);
  assert.equal(headingPage, bodyPage);
});

test("filename builder supports frozen output labels, Unicode, sanitization, and masking", () => {
  assert.equal(buildPdfFilename({ candidateName: "Rohan Kapoor", output: "global-ats-resume" }), "Rohan_Kapoor_Global_ATS_Resume.pdf");
  assert.equal(buildPdfFilename({ candidateName: "  Rohan   / \\ Kapoor ..  ", output: "domestic-resume-5", privacyMasked: true }),
    "Rohan_Kapoor_Domestic_Resume_5_Masked.pdf");
  assert.equal(buildPdfFilename({ candidateName: "रोहन कपूर", output: "gcc-resume" }), "रोहन_कपूर_GCC_Resume.pdf");
  assert.equal(buildPdfFilename({ candidateName: "रोहन कपूर", output: "gcc-resume", asciiOnly: true }), "Candidate_GCC_Resume.pdf");
  assert.equal(buildPdfFilename({ candidateName: "José Álvarez", output: "europass-eu-resume", asciiOnly: true }),
    "Jose_Alvarez_Europass_EU_Resume.pdf");
  assert.equal(buildPdfFilename({ candidateName: " \t.../\\ ", output: "general-corporate-cover-letter" }),
    "Candidate_General_Corporate_Cover_Letter.pdf");
  assert.ok(buildPdfFilename({ candidateName: "A".repeat(300), output: "technology-startup-cover-letter" }).length < 150);
  assert.throws(() => buildPdfFilename({ candidateName: "Rohan", output: "general-corporate-cover-letter", privacyMasked: true }), RangeError);
  assert.equal(sanitizePdfDownloadFilename("../../bad\r\nX-Evil: yes.pdf"), "bad_X_Evil_yes.pdf");
});

test("three-page QA content retains order, long bullets, explicit break, and repeated footer numbering", async () => {
  const source = createPdfRenderQaModel("multi-page");
  const pages = await inspect(await renderPdfDocument({ ...source,
    header: { text: "RUNNING QA HEADER" }, footer: { pageNumbers: "current-of-total" },
  }));
  assert.ok(pages.length >= 3);
  const text = pages.map((page) => page.text).join(" ");
  assert.ok(text.indexOf("Long supplied bullet 1") < text.indexOf("Long supplied bullet 13"));
  const breakPage = pages.findIndex((page) => page.text.includes("This supplied QA paragraph starts after an explicit page break"));
  assert.ok(breakPage > 0);
  for (const [index, page] of pages.entries()) {
    assert.match(page.text, /RUNNING QA HEADER/);
    assert.match(page.text, new RegExp(`Page ${index + 1} of ${pages.length}`));
    const headerY = page.items.find((item) => item.str.includes("RUNNING QA HEADER"))?.transform[5];
    const footerY = page.items.find((item) => item.str.includes(`Page ${index + 1} of ${pages.length}`))?.transform[5];
    assert.ok(typeof headerY === "number" && typeof footerY === "number");
    for (const item of page.items) {
      assert.ok(item.transform[4] >= 15 && item.transform[4] + item.width <= page.width - 15);
      assert.ok(item.transform[5] >= 15 && item.transform[5] <= page.height - 15);
      if (!item.str.includes("RUNNING QA HEADER") && !item.str.includes(`Page ${index + 1} of ${pages.length}`)) {
        assert.ok(item.transform[5] < headerY - 5 && item.transform[5] > footerY + 5,
          "Body content does not enter either running adornment band.");
      }
    }
  }
});

test("download helper supplies private PDF headers and safe Unicode/ASCII disposition", async () => {
  const response = await renderPdfDownloadResponse(model([
    { id: "body", blocks: [{ kind: "paragraph", text: "Authorized fictional download" }] },
  ]), "../रोहन कपूर\r\nX-Injected: yes.pdf");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition"), /^attachment; filename="[A-Za-z0-9_.-]+\.pdf"; filename\*=UTF-8''/);
  assert.doesNotMatch(response.headers.get("content-disposition"), /[\r\n\\/]/);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.equal(Number(response.headers.get("content-length")), bytes.byteLength);
});

test("QA POST requires admin before generation and rejects cross-origin or arbitrary scenarios", async () => {
  const request = (scenario, origin = "http://localhost:3000") => new Request("http://localhost:3000/admin/pdf-render-test/download", {
    method: "POST", headers: { origin }, body: new URLSearchParams({ scenario }),
  });
  globalThis.__pdfDownloadQaRole = async (role) => {
    assert.equal(role, "admin");
    throw new Error("ADMIN_ONLY");
  };
  await assert.rejects(() => POST(request("one-page")), /ADMIN_ONLY/);
  globalThis.__pdfDownloadQaRole = async (role) => assert.equal(role, "admin");
  assert.equal((await POST(request("one-page", "https://elsewhere.invalid"))).status, 403);
  assert.equal((await POST(request("../../profile"))).status, 400);
  const response = await POST(request("one-page"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
});
