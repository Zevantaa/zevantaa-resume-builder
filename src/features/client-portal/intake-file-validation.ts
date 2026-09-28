import type { FilePurpose, SupportedUploadMimeType } from "@/types/file-upload";

export const RESUME_LIMIT_BYTES = 10 * 1024 * 1024;
export const PHOTO_LIMIT_BYTES = 5 * 1024 * 1024;

type SupportedFile = {
  extension: string;
  mimeType: SupportedUploadMimeType;
  originalFileName: string;
  purpose: FilePurpose;
  sizeBytes: number;
};

const RESUME_MIME: Record<string, SupportedUploadMimeType> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const PHOTO_MIME: Record<string, SupportedUploadMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class IntakeFileValidationError extends Error {
  readonly field?: "resume" | "photo";

  constructor(message: string, field?: "resume" | "photo") {
    super(message);
    this.name = "IntakeFileValidationError";
    this.field = field;
  }
}

function hasSignature(bytes: Uint8Array, extension: string): boolean {
  const buffer = Buffer.from(bytes);
  if (extension === "pdf") {
    const header = buffer.subarray(0, 8).toString("ascii");
    const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString("latin1");
    return /^%PDF-[12]\.\d/.test(header) &&
      tail.includes("startxref") && tail.includes("%%EOF") &&
      tail.indexOf("startxref") < tail.lastIndexOf("%%EOF");
  }
  if (extension === "doc") {
    const magic = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    return buffer.length >= 512 && buffer.subarray(0, 8).equals(magic) &&
      buffer.readUInt16LE(28) === 0xfffe &&
      [9, 12].includes(buffer.readUInt16LE(30)) &&
      buffer.readUInt16LE(32) === 6 &&
      buffer.includes(Buffer.from("WordDocument", "utf16le"));
  }
  if (extension === "docx") return isStructuredDocx(buffer);
  if (extension === "jpg" || extension === "jpeg") return isStructuredJpeg(buffer);
  if (extension === "png") return isStructuredPng(buffer);
  if (extension === "webp") return isStructuredWebp(buffer);
  return false;
}

function isStructuredDocx(buffer: Buffer): boolean {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
  // A DOCX is a ZIP archive. Check its directory and the two essential OOXML
  // members without extracting or interpreting candidate-provided content.
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 &&
        offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) {
      end = offset;
      break;
    }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) return false;
  const count = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  let offset = buffer.readUInt32LE(end + 16);
  if (count < 2 || offset + directorySize !== end) return false;
  let contentTypes = false;
  let document = false;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) return false;
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end || ![0, 8].includes(method) || (flags & 1) !== 0 ||
        localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) return false;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    if (localOffset + 30 + localNameLength + localExtraLength + compressedSize > offset) return false;
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === "[Content_Types].xml") contentTypes = true;
    if (name === "word/document.xml") document = true;
    offset = next;
  }
  return offset === end && contentTypes && document;
}

function isStructuredJpeg(buffer: Buffer): boolean {
  if (buffer.length < 16 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  let hasFrame = false;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9) return false;
    if (offset + 2 > buffer.length) return false;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 7 || buffer.readUInt16BE(offset + 3) === 0 || buffer.readUInt16BE(offset + 5) === 0) return false;
      hasFrame = true;
    }
    if (marker === 0xda) {
      return hasFrame && buffer.lastIndexOf(Buffer.from([0xff, 0xd9])) >= offset + segmentLength;
    }
    offset += segmentLength;
  }
  return false;
}

function pngCrc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isStructuredPng(buffer: Buffer): boolean {
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 57 || !buffer.subarray(0, 8).equals(magic)) return false;
  let offset = 8;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const next = offset + 12 + length;
    if (next > buffer.length) return false;
    if (pngCrc32(buffer.subarray(offset + 4, next - 4)) !== buffer.readUInt32BE(next - 4)) return false;
    if (offset === 8 && (type !== "IHDR" || length !== 13 ||
        buffer.readUInt32BE(offset + 8) === 0 || buffer.readUInt32BE(offset + 12) === 0)) return false;
    if (type === "IDAT" && length > 0) hasImageData = true;
    if (type === "IEND") return length === 0 && hasImageData && next === buffer.length;
    offset = next;
  }
  return false;
}

function isStructuredWebp(buffer: Buffer): boolean {
  if (buffer.length < 21 || buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
      buffer.subarray(8, 12).toString("ascii") !== "WEBP" ||
      buffer.readUInt32LE(4) + 8 !== buffer.length) return false;
  const chunk = buffer.subarray(12, 16).toString("ascii");
  const chunkSize = buffer.readUInt32LE(16);
  return ["VP8 ", "VP8L", "VP8X"].includes(chunk) &&
    chunkSize > 0 && 20 + chunkSize + (chunkSize % 2) <= buffer.length;
}

export function validateIntakeFileMetadata(
  file: Pick<File, "name" | "type" | "size">,
  purpose: FilePurpose,
): SupportedFile {
  const name = file.name.normalize("NFC").trim();
  const parts = name.split(".");
  const deceptiveExtension = parts.slice(1, -1).some((part) =>
    /^(?:pdf|doc|docx|jpg|jpeg|png|webp|exe|com|scr|bat|cmd|ps1|vbs|js|msi|sh|php|html?)$/i.test(part),
  );
  if (!name || name.length > 255 || !parts[0] || deceptiveExtension ||
      /[\\/\u0000-\u001f\u007f]/.test(name) || name === "." || name === "..") {
    throw new IntakeFileValidationError("Choose a file with a valid name.");
  }
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = purpose === "source-resume" ? RESUME_MIME : PHOTO_MIME;
  const limit = purpose === "source-resume" ? RESUME_LIMIT_BYTES : PHOTO_LIMIT_BYTES;
  if (!Object.hasOwn(allowed, extension)) {
    throw new IntakeFileValidationError(
      purpose === "source-resume" ? "Use a PDF, DOC or DOCX resume." : "Use a JPEG, PNG or WebP photograph.",
    );
  }
  if (file.type !== allowed[extension]) {
    throw new IntakeFileValidationError("The file type does not match its extension.");
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > limit) {
    throw new IntakeFileValidationError(
      `The file must be no larger than ${limit / 1024 / 1024} MB and not empty.`,
    );
  }
  return {
    extension,
    mimeType: allowed[extension],
    originalFileName: name,
    purpose,
    sizeBytes: file.size,
  };
}

export async function validateIntakeFile(file: File, purpose: FilePurpose) {
  const metadata = validateIntakeFileMetadata(file, purpose);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== metadata.sizeBytes || !hasSignature(bytes, metadata.extension)) {
    throw new IntakeFileValidationError("The file content does not match the selected format.");
  }
  return { bytes, metadata };
}
