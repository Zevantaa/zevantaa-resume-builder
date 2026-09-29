"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { getAdminResumeReview } from "./admin-resume-review-service";
import type { ResumeReviewProposal } from "./resume-review-parser";

export type ReviewSaveState = { message: string; ok: boolean };

const fieldsBySection: Record<ResumeReviewProposal["section"], readonly string[]> = {
  summary: ["text"], employment: ["jobTitle", "employerName", "location", "startDate", "endDate", "isCurrentRole", "description", "highlights"],
  education: ["qualification", "institutionName", "startDate", "endDate", "completionYear", "gradeResult"], skills: ["name"],
  certifications: ["name", "issuingOrganization", "issuedOn", "issueYear", "expiresOn", "expiryYear"],
  languages: ["name", "proficiency"], projects: ["name", "description", "highlights"], additional: ["heading", "description"],
};
const month = /^\d{4}-(0[1-9]|1[0-2])$/;
const year = /^\d{4}$/;
const languageProficiency = new Set(["", "basic", "conversational", "professional-working", "fluent", "native-or-bilingual"]);

function reviewedEntries(formData: FormData, proposals: ResumeReviewProposal[]): ResumeReviewProposal[] | null {
  const approved: ResumeReviewProposal[] = [];
  for (const proposal of proposals) {
    if (formData.get(`accept:${proposal.id}`) !== "on") continue;
    const fields: Record<string, string> = {};
    for (const key of fieldsBySection[proposal.section]) {
      const value = formData.get(`field:${proposal.id}:${key}`);
      if (typeof value !== "string" || value.length > 5000) return null;
      fields[key] = value.trim();
    }
    if (Object.values(fields).some((value) => /[\u0000-\u0008\u000e-\u001f]/.test(value))) return null;
    if (proposal.section === "employment" && (!fields.jobTitle || !fields.employerName || !month.test(fields.startDate) ||
        (fields.endDate && !month.test(fields.endDate)) || !["true", "false"].includes(fields.isCurrentRole) ||
        (fields.isCurrentRole === "true" && fields.endDate) || (fields.endDate && fields.endDate < fields.startDate))) return null;
    if (proposal.section === "education" && (!fields.qualification || !fields.institutionName ||
        (fields.startDate && !month.test(fields.startDate)) || (fields.endDate && !month.test(fields.endDate)) ||
        (fields.completionYear && !year.test(fields.completionYear)) || (fields.completionYear && fields.endDate) ||
        (fields.startDate && fields.endDate && fields.endDate < fields.startDate))) return null;
    if (proposal.section === "certifications" && (!fields.name || !fields.issuingOrganization ||
        (fields.issuedOn && !month.test(fields.issuedOn)) || (fields.expiresOn && !month.test(fields.expiresOn)) ||
        (fields.issueYear && !year.test(fields.issueYear)) || (fields.expiryYear && !year.test(fields.expiryYear)) ||
        (fields.issuedOn && fields.issueYear) || (fields.expiresOn && fields.expiryYear) ||
        (fields.issuedOn && fields.expiresOn && fields.expiresOn < fields.issuedOn))) return null;
    if (["skills", "languages", "projects"].includes(proposal.section) && !fields.name) return null;
    if (proposal.section === "languages" && !languageProficiency.has(fields.proficiency)) return null;
    if (proposal.section === "additional" && !fields.heading) return null;
    if (proposal.section === "summary" && !fields.text) return null;
    approved.push({ ...proposal, fields });
  }
  return approved;
}

export async function confirmResumeReviewAction(userId: string, _previous: ReviewSaveState, formData: FormData): Promise<ReviewSaveState> {
  const admin = await requireApplicationRole("admin");
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
  return error
    ? { ok: false, message: "Confirmation could not be saved. The profile was not partially updated; reload and try again." }
    : { ok: true, message: "Approved entries were saved to the canonical profile." };
}
