import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { GlobalAtsResumeNotReadyError } from "@/features/document-generation/global-ats-resume";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";
import { persistedPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { PrivacyMaskReviewRequiredError } from "@/features/document-generation/privacy-masked-resume";
import { generateAndPersistAdminDocument } from "@/features/document-generation/persistent-document-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The route trusts only the linked server-loaded candidate profile, never POST fields. */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> {
  const { userId } = await context.params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) return new Response("Client profile was not found.", { status: 404 });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Cross-origin PDF requests are not allowed.", { status: 403 });
  }
  if (!packageAllowsOutput(profile.selectedPackage, "global-ats-resume")) {
    return new Response("This package does not include the requested resume.", { status: 422 });
  }

  try {
    return persistedPdfDownloadResponse(await generateAndPersistAdminDocument(profile.id,
      "global-ats-employer-masked"));
  } catch (error) {
    if (error instanceof GlobalAtsResumeNotReadyError) {
      return new Response("The candidate profile is incomplete. Review it before generating a resume.", {
        status: 422, headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (error instanceof PrivacyMaskReviewRequiredError) {
      return new Response("Direct contact details appear in career content. Review the profile before employer export.", {
        status: 422, headers: { "Cache-Control": "private, no-store" },
      });
    }
    return new Response("The PDF could not be generated.", {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
