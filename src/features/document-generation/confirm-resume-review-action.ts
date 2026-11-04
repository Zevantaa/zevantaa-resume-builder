"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { getAdminResumeReview } from "./admin-resume-review-service";
import { reviewedEntries } from "./resume-review-validation";

export type ReviewSaveState = { message: string; ok: boolean };

export async function confirmResumeReviewAction(userId: string, _previous: ReviewSaveState, formData: FormData): Promise<ReviewSaveState> {
  const admin = await requireApplicationRole("admin");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("resume-review", admin.userId!, 20);
  }
  if (formData.get("confirmReview") !== "yes") return { ok: false, message: "Explicit confirmation is required." };
  const review = await getAdminResumeReview(userId);
  if (!review || review.extraction.status !== "success" || !review.extraction.sourceFileId || !review.sourceHash) {
    return { ok: false, message: "The source resume is unavailable or cannot be reviewed." };
  }
  if (review.priorReview) return { ok: false, message: "This source resume has already been confirmed. Upload a replacement before another import." };
  if (formData.get("sourceHash") !== review.sourceHash) return { ok: false, message: "The source resume changed. Reload and review again." };
  const approved = reviewedEntries(formData, review.draft.proposals);
  if (!approved?.length) return { ok: false, message: "Select at least one proposed entry and check its values." };
  // The RPC is one database transaction: provenance and every approved canonical write succeed together.
  const { error } = await createSupabaseAdminClient().rpc("confirm_resume_review_v2", {
    p_profile_id: review.client.candidateProfileId,
    p_source_file_id: review.extraction.sourceFileId,
    p_extractor: review.extraction.extractor,
    p_text_sha256: review.sourceHash,
    p_admin_user_id: admin.userId,
    p_approved: approved.map(({ section, fields, sourceLines }) => ({ section, fields, sourceLines })),
  });
  if (!error && process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/audit-events")).recordSecurityEvent({
      eventType: "resume.review.confirmed", actorUserId: admin.userId!,
      targetUserId: userId, candidateProfileId: review.client.candidateProfileId, outcome: "success",
    });
  }
  return error
    ? { ok: false, message: "Confirmation could not be saved. The profile was not partially updated; reload and try again." }
    : { ok: true, message: "Approved entries were saved to the canonical profile." };
}
