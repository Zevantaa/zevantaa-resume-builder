import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { loadAdminGccPhoto } from "@/features/document-generation/gcc-photo-service";
import { buildGccResumeModel, GccResumeNotReadyError } from "@/features/document-generation/gcc-resume";
import { renderPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { buildPdfFilename } from "@/features/document-generation/pdf/pdf-filename";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only POST; candidate, photo, and storage references are resolved afresh on the server. */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) return new Response("Client profile was not found.", { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Cross-origin PDF requests are not allowed.", { status: 403 });
  }
  if (!packageAllowsOutput(profile.selectedPackage, "gcc-resume")) {
    return new Response("This package does not include the requested resume.", { status: 422 });
  }
  try {
    const mapping = mapCandidateProfileToDocumentData(profile, "resume");
    // Reject the package/profile before any private image download.
    buildGccResumeModel(mapping);
    const photo = await loadAdminGccPhoto(profile.id);
    const trustedMapping = photo
      ? mapCandidateProfileToDocumentData({ ...profile, gccPhoto: photo.reference }, "resume")
      : mapping;
    const photoDataUri = photo ? `data:image/png;base64,${Buffer.from(photo.png).toString("base64")}` : undefined;
    const output = buildGccResumeModel(trustedMapping, photoDataUri);
    const filename = buildPdfFilename({ candidateName: profile.fullName, output: "gcc-resume" });
    return await renderPdfDownloadResponse(output.model, filename, output.theme);
  } catch (error) {
    if (error instanceof GccResumeNotReadyError) {
      return new Response("This profile or package is not ready for a GCC resume.", { status: 422 });
    }
    return new Response("The GCC resume could not be generated.", {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
