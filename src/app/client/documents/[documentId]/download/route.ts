import { downloadCurrentClientDocument } from "@/features/client-portal/download-client-document";
import { sanitizePdfDownloadFilename } from "@/features/document-generation/pdf/pdf-filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Private, authenticated download of an already-persisted generated PDF. */
export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }): Promise<Response> {
  const { documentId } = await context.params;
  const result = await downloadCurrentClientDocument(documentId);
  if (!result) return new Response("Document not available.", { status: 404,
    headers: { "Cache-Control": "private, no-store, max-age=0" } });
  const asciiName = sanitizePdfDownloadFilename(result.filename.normalize("NFKD")
    .replace(/\p{M}/gu, "").replace(/[^\x20-\x7e]/g, ""));
  return new Response(new Uint8Array(result.bytes), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    "Content-Length": String(result.bytes.byteLength),
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}
