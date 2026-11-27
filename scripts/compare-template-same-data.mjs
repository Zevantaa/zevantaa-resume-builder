import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [manifestArg, outputArg] = process.argv.slice(2);
if (!manifestArg || !outputArg) {
  throw new Error("Usage: node scripts/compare-template-same-data.mjs <manifest.json> <output-directory>");
}
const manifest = JSON.parse(await readFile(path.resolve(manifestArg), "utf8"));
if (!manifest.fixtureId || !manifest.outputKind || !manifest.masterPdf || !manifest.generatedPdf ||
    !Array.isArray(manifest.requiredFacts) || manifest.requiredFacts.length < 3 ||
    manifest.requiredFacts.some((fact) => typeof fact !== "string" || fact.trim().length < 3)) {
  throw new Error("A fixture ID, output kind, both PDFs and at least three candidate fact checks are required.");
}
const destination = path.resolve(outputArg);
await mkdir(destination, { recursive: true });
const fold = (value) => value.normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase("en").trim();

async function inspect(label, pdfPath) {
  const bytes = await readFile(path.resolve(pdfPath));
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false,
    standardFontDataUrl: `${path.resolve("node_modules/pdfjs-dist/standard_fonts").replaceAll("\\", "/")}/` });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      await writeFile(path.join(destination, `${label}-${number}.png`), canvas.toBuffer("image/png"));
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str.trim());
      const [left, bottom, right, top] = page.view;
      const outside = items.filter((item) => item.transform[4] < left - 1 ||
        item.transform[4] + item.width > right + 1 || item.transform[5] < bottom - 1 ||
        item.transform[5] > top + 1).length;
      const ys = items.map((item) => item.transform[5]);
      pages.push({ page: number, width: right - left, height: top - bottom,
        text: items.map((item) => item.str).join(" "), textItems: items.length, outside,
        occupiedHeight: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
        fontNames: [...new Set(items.map((item) => item.fontName))].sort() });
      page.cleanup();
    }
  } finally { await task.destroy(); }
  return pages;
}

const master = await inspect("master", manifest.masterPdf);
const generated = await inspect("generated", manifest.generatedPdf);
async function pixelDifference(pageNumber) {
  const masterImage = await loadImage(path.join(destination, `master-${pageNumber}.png`));
  const generatedImage = await loadImage(path.join(destination, `generated-${pageNumber}.png`));
  if (masterImage.width !== generatedImage.width || masterImage.height !== generatedImage.height) return null;
  const canvas = createCanvas(masterImage.width, masterImage.height);
  const context = canvas.getContext("2d");
  context.drawImage(masterImage, 0, 0);
  const a = context.getImageData(0, 0, canvas.width, canvas.height).data;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(generatedImage, 0, 0);
  const b = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let different = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) different++;
  }
  return Number((different / (a.length / 4)).toFixed(4));
}
const pixelDifferenceByPage = await Promise.all(master.map((_, index) =>
  index < generated.length ? pixelDifference(index + 1) : null));
const joined = (pages) => fold(pages.map((page) => page.text).join(" "));
const masterText = joined(master), generatedText = joined(generated);
const facts = manifest.requiredFacts.map((fact) => ({ fact,
  master: masterText.includes(fold(fact)), generated: generatedText.includes(fold(fact)) }));
const sameDataEvidence = facts.every((row) => row.master && row.generated);
const report = { fixtureId: manifest.fixtureId, outputKind: manifest.outputKind,
  sameDataEvidence, checkedFacts: facts, master: master.map((page) => ({
    page: page.page, width: page.width, height: page.height, textItems: page.textItems,
    outside: page.outside, occupiedHeight: page.occupiedHeight, fontNames: page.fontNames })),
  generated: generated.map((page) => ({
    page: page.page, width: page.width, height: page.height, textItems: page.textItems,
    outside: page.outside, occupiedHeight: page.occupiedHeight, fontNames: page.fontNames })),
  pageCountDelta: generated.length - master.length,
  pixelDifferenceByPage,
  generatedOutsideTextItems: generated.reduce((total, page) => total + page.outside, 0),
  reviewRequired: !sameDataEvidence || generated.some((page) => page.outside > 0),
  note: "Fact checks are a prerequisite, not proof of full data equivalence. Inspect both PNG sets for overlap, typography, geometry, colour, and pagination.",
};
await writeFile(path.join(destination, "comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${manifest.outputKind}: facts ${facts.filter((row) => row.master && row.generated).length}/${facts.length}, pages ${master.length}/${generated.length}, outside ${report.generatedOutsideTextItems}; same-data evidence ${sameDataEvidence ? "PASS" : "FAIL"}\n`);
if (report.reviewRequired) process.exitCode = 1;
