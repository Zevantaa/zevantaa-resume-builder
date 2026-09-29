/** Preserve line/bullet boundaries while removing parser noise. */
export function normalizeExtractedText(rawText: string): string {
  return rawText
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n\n")
    .replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F]/g, "")
    .replace(/[\u00A0\t ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
