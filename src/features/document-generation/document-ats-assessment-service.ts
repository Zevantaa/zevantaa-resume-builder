import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { assessExtractedResumeDocument } from "./document-ats-score";
import { extractResumeTextFromBytes } from "./extract-resume-text";

type ClaimedAssessment = {
  assessment_id: string;
  candidate_profile_id: string;
  source_kind: "original" | "generated";
  source_file_id: string;
  document_record_id: string | null;
  lease_token: string;
};

export type DocumentAssessmentBatchResult = { completed: number; unavailable: number; failed: number };

/** Assess a bounded queue from the actual private file bytes. */
export async function processDocumentAtsAssessmentJobs(limit = 1): Promise<DocumentAssessmentBatchResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 2) throw new Error("Invalid document-assessment batch size.");
  const db = createSupabaseAdminClient();
  const result: DocumentAssessmentBatchResult = { completed: 0, unavailable: 0, failed: 0 };
  for (let index = 0; index < limit; index++) {
    const claimed = await db.rpc("claim_document_ats_assessment");
    if (claimed.error) throw new Error("The document-assessment queue is unavailable.");
    const job = (Array.isArray(claimed.data) ? claimed.data[0] : null) as ClaimedAssessment | null;
    if (!job) break;
    try {
      const { data: file, error } = await db.from("file_records")
        .select("id, candidate_profile_id, purpose, status, mime_type, file_extension, storage_bucket_name, storage_object_key, archived_at")
        .eq("id", job.source_file_id).eq("candidate_profile_id", job.candidate_profile_id).maybeSingle();
      const expectedBucket = job.source_kind === "original" ? "candidate-intake-private" : "candidate-documents-private";
      if (error || !file || file.archived_at || file.status !== "available" ||
          file.storage_bucket_name !== expectedBucket || !file.storage_object_key ||
          (job.source_kind === "original" && file.purpose !== "source-resume") ||
          (job.source_kind === "generated" && file.purpose !== "generated-document")) {
        throw new Error("source-unavailable");
      }
      const downloaded = await db.storage.from(expectedBucket).download(file.storage_object_key);
      if (downloaded.error || !downloaded.data) throw new Error("download-failed");
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const extraction = await extractResumeTextFromBytes({
        sourceFileId: file.id, sourceMimeType: file.mime_type,
        sourceExtension: file.file_extension, bytes,
      });
      bytes.fill(0);
      const assessment = extraction.status === "success" && extraction.normalizedText
        ? assessExtractedResumeDocument({ text: extraction.normalizedText, pageCount: extraction.pageCount,
            warnings: extraction.warnings.map(({ code }) => ({ code })) })
        : { status: "unavailable" as const, findings: [
            `Document assessment unavailable: ${extraction.failureReason ?? extraction.status}.`,
          ] };
      const completed = await db.rpc("complete_document_ats_assessment", {
        p_assessment_id: job.assessment_id, p_lease_token: job.lease_token,
        p_status: assessment.status,
        p_score: assessment.status === "ready" ? assessment.score : null,
        p_breakdown: assessment.status === "ready" ? assessment.breakdown : null,
        p_findings: assessment.findings,
      });
      if (completed.error || completed.data !== true) throw new Error("completion-failed");
      if (assessment.status === "ready") result.completed++;
      else result.unavailable++;
    } catch (error) {
      const code = error instanceof Error && ["source-unavailable", "download-failed"].includes(error.message)
        ? error.message : "assessment-failed";
      const failed = await db.rpc("fail_document_ats_assessment", {
        p_assessment_id: job.assessment_id, p_lease_token: job.lease_token, p_error_code: code,
      });
      if (failed.error || failed.data !== true) throw new Error("Document-assessment failure could not be recorded.");
      result.failed++;
    }
  }
  return result;
}
