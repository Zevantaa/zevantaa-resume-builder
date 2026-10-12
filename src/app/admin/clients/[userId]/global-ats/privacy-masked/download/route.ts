import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { GlobalAtsResumeNotReadyError } from "@/features/document-generation/global-ats-resume";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";
import { renderPdfDownloadResponse } from "@/features/document-generation/pdf/pdf-download";
import { buildPdfFilename } from "@/features/document-generation/pdf/pdf-filename";
import {
  buildPrivacyMaskedEmployerResume,
  PrivacyMaskReviewRequiredError,
} from "@/features/document-generation/privacy-masked-resume";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

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
    const mapping = mapCandidateProfileToDocumentData(profile, "resume");
    const { model, referenceId } = buildPrivacyMaskedEmployerResume(mapping);
    const filename = buildPdfFilename({ candidateName: referenceId, output: "global-ats-resume", privacyMasked: true });
    const response = await renderPdfDownloadResponse(model, filename);
    if (response.ok && process.env.NODE_ENV === "production") {
      const { getAuthContext } = await import("@/features/authentication/authorization");
      const actor = await getAuthContext();
      if (actor.userId) {
        await (await import("@/lib/security/audit-events")).recordSecurityEvent({
          eventType: "document.privacy_generated", actorUserId: actor.userId,
          targetUserId: userId, candidateProfileId: profile.id, outcome: "success",
        });
      }
    }
    return response;
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
