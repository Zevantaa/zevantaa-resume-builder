import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Frozen V1 identifiers. This manifest pairs filenames; it does not assert
// approval, source equivalence, or visual fidelity.
export const REFERENCE_PAIRS = [
  ["global-ats-resume", "aaradhayay_global_ats.html", "Global ATS Resume (1).pdf"],
  ["domestic-resume-1", "ratan_mishra_variant1_navy_gold.html", "Variant 1 - Royal Navy & Gold Boardroom.pdf"],
  ["domestic-resume-2", "ratan_mishra_variant2_sidebar.html", "Variant 2 - Contemporary Executive Sidebar.pdf"],
  ["domestic-resume-3", "ratan_mishra_variant3_masthead.html", "Variant 3 - Editorial Prestige Masthead.pdf"],
  ["domestic-resume-4", "ratan_mishra_variant4_splitgrid.html", "Variant 4 - Split-Grid Executive.pdf"],
  ["domestic-resume-5", "ratan_mishra_variant5_gold.html", "Variant 5 - Executive Gold Accent.pdf"],
  ["gcc-resume", "aaradhayay_gcc_resume.html", "GCC Regional Resume (1).pdf"],
  ["europass-eu-resume", "aaradhayay_europass_cv.html", "Europass EU CV (2).pdf"],
  ["general-corporate-cover-letter", "aaradhayay_cover_letter_corporate.html", "Cover Letter - General Corporate (Executive).pdf"],
  ["international-relocation-cover-letter", "aaradhayay_cover_letter_relocation.html", "Cover Letter - International Relocation (2).pdf"],
  ["technology-startup-cover-letter", null, null],
];

const [referenceArg, reportArg] = process.argv.slice(2);
if (!referenceArg) {
  throw new Error("Usage: node scripts/audit-master-template-references.mjs <reference-directory> [report.json]");
}
const root = path.resolve(referenceArg);
const found = new Set(await readdir(root));
const expected = new Set(REFERENCE_PAIRS.flatMap(([, html, pdf]) => [html, pdf].filter(Boolean)));
const duplicates = new Map();

async function inspectFile(filename) {
  if (!filename || !found.has(filename)) return null;
  const bytes = await readFile(path.join(root, filename));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  duplicates.set(sha256, [...(duplicates.get(sha256) ?? []), filename]);
  const result = { filename, bytes: bytes.length, sha256 };
  if (filename.endsWith(".html")) {
    const html = bytes.toString("utf8");
    result.title = /<title[^>]*>([^<]*)<\/title>/iu.exec(html)?.[1]?.trim() ?? null;
    result.pageCss = /@page\s*\{([^}]*)\}/iu.exec(html)?.[1]?.trim() ?? null;
  } else {
    const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false });
    try {
      const pdf = await task.promise;
      result.pages = pdf.numPages;
      result.selectableText = true;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        if (!content.items.some((item) => "str" in item && item.str.trim())) result.selectableText = false;
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
  }
  return result;
}

const pairs = [];
for (const [outputKind, html, pdf] of REFERENCE_PAIRS) {
  pairs.push({ outputKind, html: await inspectFile(html), pdf: await inspectFile(pdf) });
}
const report = {
  referenceDirectory: root,
  pairs,
  unexpectedFiles: [...found].filter((file) => !expected.has(file)).sort(),
  duplicateHashes: [...duplicates.values()].filter((files) => files.length > 1),
  // A file hash and page count cannot establish approved design version or
  // whether the HTML renders identically to the supplied PDF.
  approvalAndVisualMatchVerified: false,
};
if (reportArg) await writeFile(path.resolve(reportArg), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Pairs: ${pairs.filter((pair) => pair.html && pair.pdf).length}/11; missing: ${pairs.filter((pair) => !pair.html || !pair.pdf).map((pair) => pair.outputKind).join(", ") || "none"}\n`);
process.stdout.write(`Unexpected files: ${report.unexpectedFiles.length}; byte-identical duplicates: ${report.duplicateHashes.length}; all supplied PDFs selectable: ${pairs.every((pair) => !pair.pdf || pair.pdf.selectableText)}\n`);
if (report.unexpectedFiles.length || report.duplicateHashes.length) process.exitCode = 1;
