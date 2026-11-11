import "server-only";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CountResult = { count: number | null; error: unknown };
const countOf = (result: CountResult, label: string) => {
  if (result.error) throw new Error(`${label} could not be loaded.`);
  return result.count ?? 0;
};

export type WorkflowError = {
  area: "Invitation" | "Resume extraction" | "Document generation";
  profileId: string;
  code: string;
  attempts: number;
  updatedAt: string;
};

/** Read-only operational evidence. Every value comes from durable database state. */
export async function getAdminWorkflowOverview() {
  await requireApplicationRole("admin");
  const db = createSupabaseAdminClient();
  const count = (table: string, status: string) => db.from(table)
    .select("id", { count: "exact", head: true }).eq("delivery_status", status);
  const jobCount = (table: string, status: string) => db.from(table)
    .select("id", { count: "exact", head: true }).eq("status", status);

  const [inviteNotSent, invitePending, inviteSent, inviteFailed, inviteActivated, inviteAwaitingActivation,
    extractionPending, extractionProcessing, extractionNeedsInput, extractionCompleted, extractionFailed,
    generationPending, generationProcessing, generationCompleted, generationFailed,
    availableDocuments, invitationErrors, extractionErrors, generationErrors] = await Promise.all([
    count("client_onboarding_invitations", "not-sent"),
    count("client_onboarding_invitations", "pending"),
    count("client_onboarding_invitations", "sent"),
    count("client_onboarding_invitations", "failed"),
    db.from("client_onboarding_invitations").select("id", { count: "exact", head: true })
      .eq("delivery_status", "sent").not("accepted_at", "is", null),
    db.from("client_onboarding_invitations").select("id", { count: "exact", head: true })
      .eq("delivery_status", "sent").is("accepted_at", null),
    jobCount("resume_processing_jobs", "pending"), jobCount("resume_processing_jobs", "processing"),
    jobCount("resume_processing_jobs", "needs-input"), jobCount("resume_processing_jobs", "completed"),
    jobCount("resume_processing_jobs", "failed"),
    jobCount("document_regeneration_jobs", "pending"), jobCount("document_regeneration_jobs", "processing"),
    jobCount("document_regeneration_jobs", "completed"), jobCount("document_regeneration_jobs", "failed"),
    db.from("document_records").select("id", { count: "exact", head: true })
      .eq("origin", "generated").eq("status", "available").is("archived_at", null),
    db.from("client_onboarding_invitations")
      .select("candidate_profile_id, last_error_code, attempt_count, updated_at")
      .eq("delivery_status", "failed").order("updated_at", { ascending: false }).limit(10),
    db.from("resume_processing_jobs")
      .select("candidate_profile_id, last_error_code, attempts, updated_at")
      .eq("status", "failed").order("updated_at", { ascending: false }).limit(10),
    db.from("document_regeneration_jobs")
      .select("candidate_profile_id, last_error_code, attempts, updated_at")
      .eq("status", "failed").order("updated_at", { ascending: false }).limit(10),
  ]);

  const countResults = [inviteNotSent, invitePending, inviteSent, inviteFailed, inviteActivated, inviteAwaitingActivation,
    extractionPending, extractionProcessing, extractionNeedsInput, extractionCompleted, extractionFailed,
    generationPending, generationProcessing, generationCompleted, generationFailed, availableDocuments];
  if (countResults.some((result) => result.error) || invitationErrors.error || extractionErrors.error || generationErrors.error) {
    throw new Error("Operational workflow status could not be loaded.");
  }

  const errors: WorkflowError[] = [
    ...(invitationErrors.data ?? []).map((row) => ({ area: "Invitation" as const,
      profileId: row.candidate_profile_id, code: row.last_error_code ?? "delivery-failed",
      attempts: row.attempt_count, updatedAt: row.updated_at })),
    ...(extractionErrors.data ?? []).map((row) => ({ area: "Resume extraction" as const,
      profileId: row.candidate_profile_id, code: row.last_error_code ?? "processing-failed",
      attempts: row.attempts, updatedAt: row.updated_at })),
    ...(generationErrors.data ?? []).map((row) => ({ area: "Document generation" as const,
      profileId: row.candidate_profile_id, code: row.last_error_code ?? "generation-failed",
      attempts: row.attempts, updatedAt: row.updated_at })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20);

  return {
    onboarding: { notSent: countOf(inviteNotSent, "Invitation status"), pending: countOf(invitePending, "Invitation status"),
      sent: countOf(inviteSent, "Invitation status"), failed: countOf(inviteFailed, "Invitation status"),
      activated: countOf(inviteActivated, "Invitation activation"),
      awaitingActivation: countOf(inviteAwaitingActivation, "Invitation activation") },
    extraction: { pending: countOf(extractionPending, "Extraction status"), processing: countOf(extractionProcessing, "Extraction status"),
      needsInput: countOf(extractionNeedsInput, "Extraction status"), completed: countOf(extractionCompleted, "Extraction status"),
      failed: countOf(extractionFailed, "Extraction status") },
    generation: { pending: countOf(generationPending, "Generation status"), processing: countOf(generationProcessing, "Generation status"),
      completed: countOf(generationCompleted, "Generation status"), failed: countOf(generationFailed, "Generation status") },
    availableDocuments: countOf(availableDocuments, "Available document count"),
    errors,
  };
}
