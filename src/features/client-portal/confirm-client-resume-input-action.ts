"use server";

import { revalidatePath } from "next/cache";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { reviewedEntries } from "@/features/document-generation/resume-review-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { getClientResumeInputReview } from "./client-resume-input-service";

export type ClientResumeInputState = { ok: boolean; message: string };

export async function confirmClientResumeProposalsAction(
  _previous: ClientResumeInputState, formData: FormData,
): Promise<ClientResumeInputState> {
  const actor = await requireApplicationRole("client");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("resume-review", actor.userId!, 20);
  }
  const review = await getClientResumeInputReview();
  if (!review || formData.get("jobId") !== review.jobId) return { ok: false, message: "The resume input request changed. Reload and review it again." };
  if (formData.get("confirmReview") !== "yes") return { ok: false, message: "Explicit confirmation is required." };
  const approved = reviewedEntries(formData, review.proposals);
  if (!approved?.length) return { ok: false, message: "Select at least one supported entry and check its values." };
  const { error } = await createSupabaseAdminClient().rpc("confirm_client_resume_processing_input", {
    p_job_id: review.jobId,
    p_actor_user_id: actor.userId,
    p_approved: approved,
  });
  if (error) return { ok: false, message: "The corrected details could not be saved. No partial update was accepted." };
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/audit-events")).recordSecurityEvent({
      eventType: "resume.review.confirmed", actorUserId: actor.userId!, outcome: "success",
    });
  }
  revalidatePath("/client", "layout");
  return { ok: true, message: "Your confirmed details were saved. Entitled documents are now queued automatically." };
}

export async function confirmCanonicalResumeProfileAction(
  _previous: ClientResumeInputState, formData: FormData,
): Promise<ClientResumeInputState> {
  const actor = await requireApplicationRole("client");
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/rate-limit")).enforceRateLimit("resume-review", actor.userId!, 20);
  }
  const review = await getClientResumeInputReview();
  if (!review || formData.get("jobId") !== review.jobId || formData.get("confirmCanonical") !== "yes") {
    return { ok: false, message: "Reload the request and explicitly confirm your saved career profile." };
  }
  const { data, error } = await createSupabaseAdminClient().rpc("confirm_client_canonical_resume_input", {
    p_job_id: review.jobId,
    p_actor_user_id: actor.userId,
  });
  if (error || data !== true) return { ok: false, message: "The saved profile is not ready. Add verified employment, education, or project details first." };
  if (process.env.NODE_ENV === "production") {
    await (await import("@/lib/security/audit-events")).recordSecurityEvent({
      eventType: "resume.review.confirmed", actorUserId: actor.userId!, outcome: "success",
    });
  }
  revalidatePath("/client", "layout");
  return { ok: true, message: "Your saved career profile was confirmed. Entitled documents are now queued automatically." };
}
