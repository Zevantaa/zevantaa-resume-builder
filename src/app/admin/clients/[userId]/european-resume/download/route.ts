import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { EuropeanResumeNotReadyError } from "@/features/document-generation/european-resume";
import { persistedPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { generateAndPersistAdminDocument } from "@/features/document-generation/persistent-document-service";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only POST: reloads the linked reviewed profile, never accepts browser-supplied facts. */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) return new Response("Client profile was not found.", { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Cross-origin PDF requests are not allowed.", { status: 403 });
  }
  if (!packageAllowsOutput(profile.selectedPackage, "europass-eu-resume")) {
    return new Response("This package does not include the requested resume.", { status: 422 });
  }
  try {
    return persistedPdfDownloadResponse(await generateAndPersistAdminDocument(profile.id,
      "europass-eu-resume"));
  } catch (error) {
    if (error instanceof EuropeanResumeNotReadyError) {
      return new Response("This profile or package is not ready for a European resume.", { status: 422 });
    }
    return new Response("The European resume could not be generated.", {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
