import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { buildCoverLetterModel, CoverLetterNotReadyError, isCoverLetterType } from "@/features/document-generation/cover-letters";
import { renderPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { buildPdfFilename } from "@/features/document-generation/pdf/pdf-filename";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only POST; browser controls only a known format, never candidate facts. */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) return new Response("Client profile was not found.", { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Cross-origin PDF requests are not allowed.", { status: 403 });
  }
  let type: FormDataEntryValue | null;
  try { type = (await request.formData()).get("type"); }
  catch { return new Response("Invalid cover-letter request.", { status: 400 }); }
  if (!isCoverLetterType(type)) return new Response("Unknown cover-letter type.", { status: 400 });
  if (!packageAllowsOutput(profile.selectedPackage, `${type}-cover-letter`)) {
    return new Response("This package does not include the requested cover letter.", { status: 422 });
  }
  try {
    const output = buildCoverLetterModel(mapCandidateProfileToDocumentData(profile, "cover-letter"), type);
    const filename = buildPdfFilename({ candidateName: profile.fullName, output: `${type}-cover-letter` });
    return await renderPdfDownloadResponse(output.model, filename, output.theme);
  } catch (error) {
    if (error instanceof CoverLetterNotReadyError) {
      return new Response("This profile or package is not ready for a cover letter.", { status: 422 });
    }
    return new Response("The cover letter could not be generated.", {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
