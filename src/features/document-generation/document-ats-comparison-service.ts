import "server-only";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { resolveLinkedClientProfile } from "@/features/client-portal/contact-profile-service";
import { OUTPUT_TITLES } from "@/features/client-portal/client-dashboard-view";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { AtsScoreBreakdown } from "./indicative-ats-score";

export type DocumentAssessmentState = {
  status: "missing" | "pending" | "processing" | "ready" | "unavailable" | "failed";
  score: number | null;
  breakdown: AtsScoreBreakdown[];
  assessedAt: string | null;
  algorithmVersion: string | null;
};

export type DocumentAtsVariant = {
  documentId: string;
  optimized: DocumentAssessmentState & { label: string; version: number };
  compatible: boolean;
  delta: number | null;
  improvements: { dimension: string; label: string; before: number; after: number; delta: number; explanation: string }[];
};

export type DocumentAtsComparisonView = {
  original: DocumentAssessmentState;
  variants: DocumentAtsVariant[];
};

const missing = (): DocumentAssessmentState => ({
  status: "missing", score: null, breakdown: [], assessedAt: null, algorithmVersion: null,
});

async function loadForProfile(profileId: string): Promise<DocumentAtsComparisonView | null> {
  const db = createSupabaseAdminClient();
  const [{ data: profile, error: profileError }, { data: generatedRows, error: generatedError }] = await Promise.all([
    db.from("candidate_profiles").select("existing_resume_file_id").eq("id", profileId).maybeSingle(),
    db.from("document_records")
      .select("id, file_record_id, output_kind, version_number")
      .eq("candidate_profile_id", profileId).eq("origin", "generated")
      .eq("status", "available").eq("is_privacy_masked", false).is("archived_at", null)
      .not("file_record_id", "is", null).order("version_number", { ascending: false }),
  ]);
  if (profileError || generatedError || !profile) throw new Error("ATS document provenance could not be loaded.");

  const generated = (generatedRows ?? []).filter((row) =>
    typeof row.output_kind === "string" && !row.output_kind.endsWith("cover-letter"),
  ).filter((row, index, rows) => rows.findIndex((candidate) => candidate.output_kind === row.output_kind) === index);
  const fileIds = [profile.existing_resume_file_id, ...generated.map((row) => row.file_record_id)]
    .filter((id): id is string => typeof id === "string");
  const { data: rows, error } = fileIds.length ? await db.from("document_ats_assessments")
    .select("source_kind, source_file_id, status, overall_score, breakdown, assessed_at, algorithm_version")
    .eq("candidate_profile_id", profileId).in("source_file_id", fileIds)
    : { data: [], error: null };
  if (error) throw new Error("ATS document assessments could not be loaded.");

  const state = (kind: "original" | "generated", fileId: string | null | undefined): DocumentAssessmentState => {
    const row = rows?.find((item) => item.source_kind === kind && item.source_file_id === fileId);
    if (!row) return missing();
    return {
      status: row.status as DocumentAssessmentState["status"],
      score: typeof row.overall_score === "number" ? row.overall_score : null,
      breakdown: Array.isArray(row.breakdown) ? row.breakdown as AtsScoreBreakdown[] : [],
      assessedAt: row.assessed_at ?? null,
      algorithmVersion: row.algorithm_version ?? null,
    };
  };
  const original = state("original", profile.existing_resume_file_id);
  const before = new Map(original.breakdown.map((item) => [item.dimension, item]));
  const variants = generated.map((document): DocumentAtsVariant => {
    const optimized = state("generated", document.file_record_id);
    const compatible = original.status === "ready" && optimized.status === "ready" &&
      original.algorithmVersion === optimized.algorithmVersion;
    return {
      documentId: document.id,
      optimized: {
        ...optimized,
        label: document.output_kind && document.output_kind in OUTPUT_TITLES
          ? OUTPUT_TITLES[document.output_kind as keyof typeof OUTPUT_TITLES]
          : "Generated resume",
        version: document.version_number,
      },
      compatible,
      delta: compatible && original.score !== null && optimized.score !== null
        ? optimized.score - original.score : null,
      improvements: compatible ? optimized.breakdown.flatMap((item) => {
        const prior = before.get(item.dimension);
        return prior && item.score > prior.score ? [{
          dimension: item.dimension, label: item.label, before: prior.score,
          after: item.score, delta: item.score - prior.score, explanation: item.reason,
        }] : [];
      }) : [],
    };
  });
  return { original, variants };
}

export async function getCurrentClientDocumentAtsComparison(): Promise<DocumentAtsComparisonView | null> {
  const linked = await resolveLinkedClientProfile();
  return linked ? loadForProfile(linked.profileId) : null;
}

export async function getAdminDocumentAtsComparison(profileId: string): Promise<DocumentAtsComparisonView | null> {
  await requireApplicationRole("admin");
  return loadForProfile(profileId);
}
