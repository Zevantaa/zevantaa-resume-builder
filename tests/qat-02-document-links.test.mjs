import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

test("PDF contact links never expose active, private-host, or local-file targets", async () => {
  const candidates = [
    "https://example.org/fictional-profile",
    "https://127.0.0.1/private",
    "https://intranet.internal/private",
    "http://example.org/insecure",
    "javascript:alert(1)",
    "file:///etc/passwd",
  ];
  const bytes = await renderPdfDocument({ sourceProfileId: "00000000-0000-4000-8000-000000000001",
    title: "Fictional link-security QA", sections: [{ id: "identity", blocks: [{ kind: "contact-row",
      items: candidates.map((href) => ({ text: href, href })) }] }] });
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  try {
    const annotations = await (await pdf.getPage(1)).getAnnotations();
    assert.deepEqual(annotations.map((item) => item.url).filter(Boolean), [candidates[0]]);
  } finally { await task.destroy(); }
});
