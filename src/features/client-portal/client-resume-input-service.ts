import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ResumeReviewProposal } from "@/features/document-generation/resume-review-parser";

import { resolveLinkedClientProfile } from "./contact-profile-service";

export type ClientResumeInputReview = {
  jobId: string;
  findings: { code: string; message: string }[];
  proposals: ResumeReviewProposal[];
};

function proposals(value: unknown): ResumeReviewProposal[] {
  if (!Array.isArray(value) || value.length > 200) return [];
  return value.filter((item): item is ResumeReviewProposal => Boolean(item && typeof item === "object" &&
    typeof (item as ResumeReviewProposal).id === "string" &&
    typeof (item as ResumeReviewProposal).section === "string" &&
    Array.isArray((item as ResumeReviewProposal).sourceLines) &&
    (item as ResumeReviewProposal).fields && typeof (item as ResumeReviewProposal).fields === "object"));
}

export async function getClientResumeInputReview(): Promise<ClientResumeInputReview | null> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;
  const db = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await db.from("candidate_profiles")
    .select("existing_resume_file_id").eq("id", linked.profileId)
    .is("archived_at", null).maybeSingle();
  if (profileError || !profile?.existing_resume_file_id) return null;
  const { data: job, error } = await db.from("resume_processing_jobs")
    .select("id, structured_result, readiness_findings")
    .eq("candidate_profile_id", linked.profileId)
    .eq("source_file_id", profile.existing_resume_file_id)
    .eq("status", "needs-input").maybeSingle();
  if (error || !job) return null;
  const structured = job.structured_result && typeof job.structured_result === "object"
    ? job.structured_result as { proposals?: unknown } : {};
  const findings = Array.isArray(job.readiness_findings) ? job.readiness_findings.filter((item): item is { code: string; message: string } =>
    Boolean(item && typeof item === "object" && typeof item.code === "string" && typeof item.message === "string")) : [];
  return { jobId: job.id, findings, proposals: proposals(structured.proposals) };
}
