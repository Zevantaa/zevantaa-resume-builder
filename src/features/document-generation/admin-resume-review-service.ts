import "server-only";

import { createHash } from "node:crypto";

import { getProvisionedClient } from "@/features/admin-portal/client-account-service";
import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { extractProfileSourceResume } from "./current-client-resume-service";
import { parseResumeReview } from "./resume-review-parser";

export async function getAdminResumeReview(userId: string) {
  await requireApplicationRole("admin");
  const client = await getProvisionedClient(userId);
  if (!client) return null;
  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase.from("candidate_profiles")
    .select("existing_resume_file_id, professional_summary")
    .eq("id", client.candidateProfileId).is("archived_at", null).maybeSingle();
  if (profileError || !profile) throw new Error("Client profile could not be loaded.");
  const fileId = profile.existing_resume_file_id;
  const { data: file } = fileId ? await supabase.from("file_records")
    .select("original_file_name, mime_type")
    .eq("id", fileId).eq("candidate_profile_id", client.candidateProfileId).maybeSingle() : { data: null };
  const extraction = await extractProfileSourceResume(client.candidateProfileId);
  const draft = extraction.status === "success" && extraction.normalizedText
    ? parseResumeReview(extraction.normalizedText) : { proposals: [], warnings: [] };
  const sourceHash = extraction.normalizedText
    ? createHash("sha256").update(extraction.normalizedText).digest("hex") : null;
  const { data: priorReview } = fileId ? await supabase.from("profile_resume_reviews")
    .select("id, confirmed_at").eq("candidate_profile_id", client.candidateProfileId)
    .eq("source_file_id", fileId).maybeSingle() : { data: null };
  return { client, file, extraction, draft, sourceHash, canonicalSummary: profile.professional_summary, priorReview };
}
