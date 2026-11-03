import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { extractProfileSourceResume } from "./current-client-resume-service";
import { assessResumeExtraction } from "./resume-processing-readiness";

type ClaimedResumeJob = {
  job_id: string;
  candidate_profile_id: string;
  source_file_id: string;
  source_content_sha256: string;
  lease_token: string;
};

export type ResumeProcessingBatchResult = {
  completed: number;
  needsInput: number;
  failed: number;
};

/** Process a bounded global batch. Durable leases make interruption recoverable. */
export async function processResumeProcessingJobs(limit = 1): Promise<ResumeProcessingBatchResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 2) {
    throw new Error("Invalid source-processing batch size.");
  }
  const db = createSupabaseAdminClient();
  const result: ResumeProcessingBatchResult = { completed: 0, needsInput: 0, failed: 0 };

  for (let index = 0; index < limit; index++) {
    const claimed = await db.rpc("claim_resume_processing_job", { p_profile_id: null });
    if (claimed.error) throw new Error("The source-processing queue is unavailable.");
    const job = (Array.isArray(claimed.data) ? claimed.data[0] : null) as ClaimedResumeJob | null;
    if (!job) break;

    try {
      const extraction = await extractProfileSourceResume(job.candidate_profile_id);
      if (extraction.sourceFileId && extraction.sourceFileId !== job.source_file_id) {
        throw new Error("source-replaced");
      }
      const assessment = assessResumeExtraction(extraction);
      if (assessment.outcome === "retry") {
        const failed = await db.rpc("fail_resume_processing_job", {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_error_code: assessment.errorCode,
        });
        if (failed.error || failed.data !== true) throw new Error("Source-processing retry could not be recorded.");
        result.failed++;
        continue;
      }
      const completed = await db.rpc("complete_resume_processing_job", {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_status: assessment.outcome,
        p_extractor: assessment.extractor,
        p_normalized_text_sha256: assessment.normalizedTextSha256,
        p_structured_result: assessment.structuredResult,
        p_readiness_findings: assessment.findings,
      });
      if (completed.error || completed.data !== true) {
        throw new Error("Source-processing completion could not be recorded.");
      }
      if (assessment.outcome === "completed") result.completed++;
      else result.needsInput++;
    } catch (error) {
      const code = error instanceof Error && error.message === "source-replaced"
        ? "source-replaced" : "processing-failed";
      const failed = await db.rpc("fail_resume_processing_job", {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_error_code: code,
      });
      if (failed.error) throw new Error("Source-processing failure could not be recorded.");
      result.failed++;
    }
  }
  return result;
}
