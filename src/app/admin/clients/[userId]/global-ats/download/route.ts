import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { buildGlobalAtsResumeModel, GlobalAtsResumeNotReadyError } from "@/features/document-generation/global-ats-resume";
import { renderPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { buildPdfFilename } from "@/features/document-generation/pdf/pdf-filename";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST-only; a browser cannot supply profile IDs, document fields, or PDF layout data. */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) return new Response("Client profile was not found.", { status: 404 });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Cross-origin PDF requests are not allowed.", { status: 403 });
  }

  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  try {
    const model = buildGlobalAtsResumeModel(mapping);
    const filename = buildPdfFilename({ candidateName: profile.fullName, output: "global-ats-resume" });
    return await renderPdfDownloadResponse(model, filename);
  } catch (error) {
    if (error instanceof GlobalAtsResumeNotReadyError) {
      return new Response("The candidate profile is incomplete. Review it before generating a resume.", { status: 422 });
    }
    return new Response("The PDF could not be generated.", {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
