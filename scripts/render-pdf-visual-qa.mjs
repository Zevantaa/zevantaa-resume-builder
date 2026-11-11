import { createCanvas } from "@napi-rs/canvas";
import { readdir, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error("Usage: node scripts/render-pdf-visual-qa.mjs <pdf-directory> <png-directory>");
}

const inputDirectory = path.resolve(inputArg);
const outputDirectory = path.resolve(outputArg);
const standardFontDataUrl = `${path.resolve("node_modules/pdfjs-dist/standard_fonts").replaceAll("\\", "/")}/`;
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const pdfFiles = (await readdir(inputDirectory)).filter((name) => name.toLowerCase().endsWith(".pdf")).sort();
if (!pdfFiles.length) throw new Error(`No PDFs found in ${inputDirectory}`);

const report = [];
for (const filename of pdfFiles) {
  const bytes = await readFile(path.join(inputDirectory, filename));
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false,
    standardFontDataUrl });
  const pdf = await task.promise;
  const documentDirectory = path.join(outputDirectory, path.basename(filename, ".pdf"));
  await mkdir(documentDirectory, { recursive: true });
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const pngName = `page-${String(pageNumber).padStart(2, "0")}.png`;
      await writeFile(path.join(documentDirectory, pngName), canvas.toBuffer("image/png"));

      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str.trim());
      const ys = items.map((item) => item.transform[5]);
      const top = ys.length ? Math.max(...ys) : 0;
      const bottom = ys.length ? Math.min(...ys) : 0;
      const occupiedHeight = top - bottom;
      pages.push({
        pageNumber,
        png: path.relative(process.cwd(), path.join(documentDirectory, pngName)),
        textItems: items.length,
        occupiedHeight: Number(occupiedHeight.toFixed(1)),
        occupancyRatio: Number((occupiedHeight / page.view[3]).toFixed(3)),
        sparse: pageNumber > 1 && (items.length === 0 || occupiedHeight / page.view[3] < 0.25),
      });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  report.push({ filename, pageCount: pages.length, pages });
}

await writeFile(path.join(outputDirectory, "visual-qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const document of report) {
  const pageSummary = document.pages.map((page) => `${page.pageNumber}:${page.occupancyRatio}${page.sparse ? "!" : ""}`).join(" ");
  process.stdout.write(`${document.filename}\t${document.pageCount} page(s)\t${pageSummary}\n`);
}
