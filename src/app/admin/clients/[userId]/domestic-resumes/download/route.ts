import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { DomesticResumeNotReadyError, isDomesticDesignId } from "@/features/document-generation/domestic-resumes";
import { persistedPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { generateAndPersistAdminDocument } from "@/features/document-generation/persistent-document-service";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only POST: the browser supplies one design ID, never candidate facts. */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) return new Response("Client profile was not found.", { status: 404 });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response("Cross-origin PDF requests are not allowed.", { status: 403 });
  let design: FormDataEntryValue | null;
  try { design = (await request.formData()).get("design"); }
  catch { return new Response("Invalid domestic resume request.", { status: 400 }); }
  if (typeof design !== "string" || !isDomesticDesignId(design)) return new Response("Unknown domestic resume design.", { status: 400 });
  if (!packageAllowsOutput(profile.selectedPackage, `domestic-resume-${design}`)) {
    return new Response("This package does not include the requested resume.", { status: 422 });
  }

  try {
    return persistedPdfDownloadResponse(await generateAndPersistAdminDocument(profile.id,
      `domestic-resume-${design}`));
  } catch (error) {
    if (error instanceof DomesticResumeNotReadyError) return new Response("This profile or package is not ready for a domestic resume.", { status: 422 });
    return new Response("The domestic resume could not be generated.", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
