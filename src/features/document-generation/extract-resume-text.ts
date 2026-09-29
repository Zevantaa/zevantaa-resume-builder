import "server-only";

import mammoth from "mammoth";
import WordExtractor from "word-extractor";

import { hasSupportedFileSignature, RESUME_LIMIT_BYTES } from "@/features/client-portal/intake-file-validation";
import type { ResumeExtractionFailureReason, ResumeExtractionResult, ResumeExtractor } from "@/types/resume-extraction";

import { normalizeExtractedText } from "./normalize-extracted-text";

const FORMATS = {
  doc: { mime: "application/msword", extractor: "word-extractor" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extractor: "mammoth" },
  pdf: { mime: "application/pdf", extractor: "pdfjs-dist" },
} as const;
const MAX_UNCOMPRESSED_DOCX_BYTES = 40 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;
const MAX_PDF_PAGES = 100;
const MIN_MEANINGFUL_CHARACTERS = 20;

export interface ResumeSourceBytes {
  sourceFileId: string;
  sourceMimeType: string;
  sourceExtension: string;
  bytes: Uint8Array;
}

export function extractionFailure(
  sourceFileId: string | null,
  sourceMimeType: string | null,
  sourceExtension: string | null,
  failureReason: ResumeExtractionFailureReason,
  status: "failed" | "unsupported" = "failed",
  extractor: ResumeExtractor | null = null,
): ResumeExtractionResult {
  return {
    sourceFileId, sourceMimeType, sourceExtension, extractor,
    rawText: null, normalizedText: null, pageCount: null,
    warnings: [], status, failureReason,
  };
}

function docxArchiveProblem(bytes: Uint8Array): ResumeExtractionFailureReason | null {
  const buffer = Buffer.from(bytes);
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) {
      end = offset;
      break;
    }
  }
  if (end < 0) return "invalid-file";
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count > 1000) return "extraction-limit";
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) return "invalid-file";
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end || size === 0xffffffff) return "invalid-file";
    total += size;
    if (total > MAX_UNCOMPRESSED_DOCX_BYTES) return "extraction-limit";
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (/(?:^|\/)vbaProject\.bin$/i.test(name)) return "active-content";
    offset = next;
  }
  return offset === end ? null : "invalid-file";
}

async function extractPdf(bytes: Uint8Array): Promise<{ rawText: string; pageCount: number; lowTextPages: number[] }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw new RangeError("PDF page limit exceeded");
    const pages: string[] = [];
    const lowTextPages: number[] = [];
    let totalLength = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = "";
      let previousY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        const y = item.transform[5];
        if (line && previousY !== undefined && Math.abs(y - previousY) > 2) {
          lines.push(line);
          line = "";
        }
        line += line && !/\s$/.test(line) && !/^\s/.test(item.str) ? ` ${item.str}` : item.str;
        previousY = y;
        if (item.hasEOL) { lines.push(line); line = ""; previousY = undefined; }
      }
      if (line) lines.push(line);
      const pageText = lines.join("\n");
      if (meaningfulLength(pageText) < MIN_MEANINGFUL_CHARACTERS) lowTextPages.push(pageNumber);
      pages.push(pageText);
      totalLength += pageText.length + 1;
      if (totalLength > MAX_EXTRACTED_CHARACTERS) throw new RangeError("PDF text limit exceeded");
    }
    return { rawText: pages.join("\f"), pageCount: pdf.numPages, lowTextPages };
  } finally {
    await task.destroy();
  }
}

function meaningfulLength(text: string): number {
  let count = 0;
  for (const match of text.matchAll(/[\p{L}\p{N}]/gu)) {
    if (match[0] && ++count >= MIN_MEANINGFUL_CHARACTERS) break;
  }
  return count;
}

/** In-memory extraction only; never execute embedded content or write candidate facts. */
export async function extractResumeTextFromBytes(source: ResumeSourceBytes): Promise<ResumeExtractionResult> {
  const extension = source.sourceExtension.toLowerCase();
  const format = FORMATS[extension as keyof typeof FORMATS];
  if (!format || source.sourceMimeType !== format.mime) {
    return extractionFailure(source.sourceFileId, source.sourceMimeType, extension, "unsupported-format", "unsupported");
  }
  const extractor = format.extractor;
  if (!source.bytes.length || source.bytes.length > RESUME_LIMIT_BYTES ||
      !hasSupportedFileSignature(source.bytes, extension)) {
    return extractionFailure(source.sourceFileId, source.sourceMimeType, extension, "invalid-file", "failed", extractor);
  }
  if (extension === "docx") {
    const problem = docxArchiveProblem(source.bytes);
    if (problem) return extractionFailure(source.sourceFileId, source.sourceMimeType, extension, problem, "unsupported", extractor);
  }

  try {
    let rawText: string;
    let pageCount: number | null = null;
    const warnings: ResumeExtractionResult["warnings"] = [];
    if (extension === "doc") {
      rawText = (await new WordExtractor().extract(Buffer.from(source.bytes))).getBody();
    } else if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(source.bytes) });
      rawText = result.value;
      if (result.messages.length) warnings.push({ code: "conversion-warning", message: "Some DOCX content may need manual review." });
    } else {
      const result = await extractPdf(source.bytes);
      rawText = result.rawText;
      pageCount = result.pageCount;
      if (result.lowTextPages.length) warnings.push({ code: "low-text-page", message: "One or more PDF pages have little extractable text." });
    }
    if (rawText.length > MAX_EXTRACTED_CHARACTERS) {
      return extractionFailure(source.sourceFileId, source.sourceMimeType, extension, "extraction-limit", "unsupported", extractor);
    }
    const normalizedText = normalizeExtractedText(rawText);
    const insufficient = meaningfulLength(normalizedText) < MIN_MEANINGFUL_CHARACTERS;
    return {
      sourceFileId: source.sourceFileId,
      sourceMimeType: source.sourceMimeType,
      sourceExtension: extension,
      extractor,
      rawText,
      normalizedText,
      pageCount,
      warnings,
      status: insufficient ? "insufficient-text" : "success",
      failureReason: insufficient ? "insufficient-text" : null,
    };
  } catch (error) {
    const reason = error instanceof RangeError ? "extraction-limit" :
      error instanceof Error && error.name === "PasswordException" ? "encrypted-file" : "corrupt-file";
    return extractionFailure(
      source.sourceFileId, source.sourceMimeType, extension, reason,
      reason === "encrypted-file" || reason === "extraction-limit" ? "unsupported" : "failed", extractor,
    );
  }
}
