import { requireApplicationRole } from "@/features/authentication/authorization";
import { createLongGlobalAtsQaProfile } from "@/features/document-generation/global-ats-qa-fixture";
import { buildGlobalAtsResumeModel } from "@/features/document-generation/global-ats-resume";
import { buildDomesticResumeModel, isDomesticDesignId } from "@/features/document-generation/domestic-resumes";
import { createGccQaPhotoDataUri, createGccQaProfile } from "@/features/document-generation/gcc-qa-fixture";
import { buildGccResumeModel } from "@/features/document-generation/gcc-resume";
import { createPdfRenderQaModel } from "@/features/document-generation/pdf/pdf-render-qa-fixtures";
import type { PdfRenderQaScenario } from "@/features/document-generation/pdf/pdf-render-qa-types";
import { renderPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { buildPdfFilename } from "@/features/document-generation/pdf/pdf-filename";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

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
  const domesticDesign = typeof scenario === "string" && scenario.startsWith("domestic-") ? scenario.slice(9) : "";
  const gccScenario = scenario === "gcc-with-photo" || scenario === "gcc-without-photo" || scenario === "gcc-long";
  if (typeof scenario !== "string" || (scenario !== "global-ats-long" && !gccScenario && !isDomesticDesignId(domesticDesign) && !Object.hasOwn(names, scenario))) {
    return new Response("Unknown PDF QA scenario.", { status: 400 });
  }

  try {
    if (gccScenario) {
      const profile = createGccQaProfile(scenario === "gcc-long");
      const photoDataUri = scenario === "gcc-with-photo" ? await createGccQaPhotoDataUri() : undefined;
      const output = buildGccResumeModel(mapCandidateProfileToDocumentData(profile, "resume"), photoDataUri);
      return await renderPdfDownloadResponse(output.model,
        buildPdfFilename({ candidateName: profile.fullName, output: "gcc-resume" }), output.theme);
    }
    if (isDomesticDesignId(domesticDesign)) {
      const profile = createLongGlobalAtsQaProfile();
      const output = buildDomesticResumeModel(mapCandidateProfileToDocumentData(profile, "resume"), domesticDesign);
      const filename = buildPdfFilename({ candidateName: profile.fullName, output: `domestic-resume-${domesticDesign}` });
      return await renderPdfDownloadResponse(output.model, filename, output.theme);
    }
    if (scenario === "global-ats-long") {
      const profile = createLongGlobalAtsQaProfile();
      const model = buildGlobalAtsResumeModel(mapCandidateProfileToDocumentData(profile, "resume"));
      const filename = buildPdfFilename({ candidateName: profile.fullName, output: "global-ats-resume" });
      return await renderPdfDownloadResponse(model, filename);
    }
    const selected = scenario as PdfRenderQaScenario;
    return await renderPdfDownloadResponse(createPdfRenderQaModel(selected), names[selected]);
  } catch {
    return new Response("The QA PDF could not be generated.", {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
