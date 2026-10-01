import "server-only";

import type { PdfDocumentModel } from "./pdf-model";
import type { PdfThemeOverrides } from "./pdf-theme";
import { sanitizePdfDownloadFilename } from "./pdf-filename";
import { renderPdfDocument } from "./render-pdf";

/**
 * Call only after the route has authorized the requester and assembled its
 * document model from server-trusted data. Never pass browser-supplied facts.
 */
export async function renderPdfDownloadResponse(model: PdfDocumentModel, filename: string, theme: PdfThemeOverrides = {}): Promise<Response> {
  const safeName = sanitizePdfDownloadFilename(filename);
  const asciiFallback = sanitizePdfDownloadFilename(safeName.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\x20-\x7e]/g, ""));
  const pdf = await renderPdfDocument(model, theme);
  const disposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
  return new Response(new Uint8Array(pdf), { status: 200, headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": disposition,
    "Content-Length": String(pdf.byteLength),
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}
