import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ResumeReviewProposal } from "@/features/document-generation/resume-review-parser";

import { resolveLinkedClientProfile } from "./contact-profile-service";

export type ClientResumeInputReview = {
  jobId: string;
  findings: { code: string; message: string }[];
  proposals: ResumeReviewProposal[];
  proposalStates: Record<string, "new" | "already-saved" | "conflict">;
  profile: {
    fullName: string;
    primaryEmail: string;
    mobileNumber: string;
    whatsappNumber: string;
    linkedinUrl: string;
    currentLocation: string;
    relocationPreference: "open" | "not-open" | "conditional" | "not-specified";
  };
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
  const extracted = proposals(structured.proposals);
  const [profileData, employment, education, skills, certifications, languages, projects] = await Promise.all([
    db.from("candidate_profiles").select("professional_summary, full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference").eq("id", linked.profileId).maybeSingle(),
    db.from("profile_work_experiences").select("job_title, employer_name, location, start_date, end_date, is_current_role")
      .eq("candidate_profile_id", linked.profileId).is("archived_at", null),
    db.from("profile_education_entries").select("qualification, institution_name, start_date, end_date, completion_year")
      .eq("candidate_profile_id", linked.profileId).is("archived_at", null),
    db.from("profile_skills").select("name").eq("candidate_profile_id", linked.profileId).is("archived_at", null),
    db.from("profile_certifications").select("name, issuing_organization, issued_on, issue_year, expires_on, expiry_year")
      .eq("candidate_profile_id", linked.profileId).is("archived_at", null),
    db.from("profile_languages").select("name, proficiency").eq("candidate_profile_id", linked.profileId).is("archived_at", null),
    db.from("profile_projects").select("name").eq("candidate_profile_id", linked.profileId).is("archived_at", null),
  ]);
  if ([profileData, employment, education, skills, certifications, languages, projects].some((result) => result.error)) {
    throw new Error("Saved profile facts could not be compared safely.");
  }
  if (!profileData.data) throw new Error("The linked client profile is unavailable.");
  const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const same = (left: unknown, right: unknown) => normalize(left) === normalize(right);
  const proposalStates: ClientResumeInputReview["proposalStates"] = {};
  for (const proposal of extracted) {
    const fields = proposal.fields;
    let keyMatches: Record<string, unknown>[] = [];
    let exact = false;
    if (proposal.section === "summary") {
      const saved = profileData.data?.professional_summary;
      if (saved) { keyMatches = [{ saved }]; exact = same(saved, fields.text); }
    } else if (proposal.section === "employment") {
      keyMatches = (employment.data ?? []).filter((row) => same(row.job_title, fields.jobTitle) && same(row.employer_name, fields.employerName));
      exact = keyMatches.some((row) => same(row.location, fields.location) && same(row.start_date, fields.startDate) &&
        same(row.end_date, fields.endDate) && String(row.is_current_role) === fields.isCurrentRole);
    } else if (proposal.section === "education") {
      keyMatches = (education.data ?? []).filter((row) => same(row.qualification, fields.qualification) && same(row.institution_name, fields.institutionName));
      exact = keyMatches.some((row) => same(row.start_date, fields.startDate) && same(row.end_date, fields.endDate) && same(row.completion_year, fields.completionYear));
    } else if (proposal.section === "skills") {
      keyMatches = (skills.data ?? []).filter((row) => same(row.name, fields.name)); exact = keyMatches.length > 0;
    } else if (proposal.section === "certifications") {
      keyMatches = (certifications.data ?? []).filter((row) => same(row.name, fields.name) && same(row.issuing_organization, fields.issuingOrganization));
      exact = keyMatches.some((row) => same(row.issued_on, fields.issuedOn) && same(row.issue_year, fields.issueYear) &&
        same(row.expires_on, fields.expiresOn) && same(row.expiry_year, fields.expiryYear));
    } else if (proposal.section === "languages") {
      keyMatches = (languages.data ?? []).filter((row) => same(row.name, fields.name));
      exact = keyMatches.some((row) => same(row.proficiency, fields.proficiency));
    } else if (proposal.section === "projects") {
      keyMatches = (projects.data ?? []).filter((row) => same(row.name, fields.name)); exact = keyMatches.length > 0;
    }
    proposalStates[proposal.id] = exact ? "already-saved" : keyMatches.length ? "conflict" : "new";
  }
  return {
    jobId: job.id, findings, proposals: extracted, proposalStates,
    profile: {
      fullName: profileData.data.full_name,
      primaryEmail: profileData.data.primary_email,
      mobileNumber: profileData.data.mobile_number,
      whatsappNumber: profileData.data.whatsapp_number ?? "",
      linkedinUrl: profileData.data.linkedin_url ?? "",
      currentLocation: profileData.data.current_location,
      relocationPreference: profileData.data.relocation_preference,
    },
  };
}
