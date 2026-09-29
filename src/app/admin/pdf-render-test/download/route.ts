import { requireApplicationRole } from "@/features/authentication/authorization";
import { createPdfRenderQaModel } from "@/features/document-generation/pdf/pdf-render-qa-fixtures";
import type { PdfRenderQaScenario } from "@/features/document-generation/pdf/pdf-render-qa-types";
import { renderPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const names: Record<PdfRenderQaScenario, string> = {
  "one-page": "Development_QA_One_Page.pdf",
  "multi-page": "Development_QA_Multi_Page.pdf",
  unicode: "Development_QA_Unicode.pdf",
  "header-footer": "Development_QA_Header_Footer.pdf",
};

/** Admin-only POST harness. No candidate ID, profile data, or storage path is accepted. */
export async function POST(request: Request): Promise<Response> {
  await requireApplicationRole("admin");

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Cross-origin PDF requests are not allowed.", { status: 403 });
  }

  let scenario: FormDataEntryValue | null;
  try {
    scenario = (await request.formData()).get("scenario");
  } catch {
    return new Response("Invalid PDF QA request.", { status: 400 });
  }
  if (typeof scenario !== "string" || !Object.hasOwn(names, scenario)) {
    return new Response("Unknown PDF QA scenario.", { status: 400 });
  }

  try {
    const selected = scenario as PdfRenderQaScenario;
    return await renderPdfDownloadResponse(createPdfRenderQaModel(selected), names[selected]);
  } catch {
    return new Response("The QA PDF could not be generated.", {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
