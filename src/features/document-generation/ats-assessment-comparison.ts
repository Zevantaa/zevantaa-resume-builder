import type { AtsScoreBreakdown } from "./indicative-ats-score";

export type AtsAssessmentSnapshot = {
  career_revision: number;
  algorithm_version: string;
  score: number;
  breakdown: AtsScoreBreakdown[];
  assessed_at: string;
};

export type AtsAssessmentComparison = {
  algorithmVersion: string;
  before: { score: number; revision: number; assessedAt: string };
  after: { score: number; revision: number; assessedAt: string };
  improvements: { dimension: string; label: string; before: number; after: number; delta: number; explanation: string }[];
};

export function compareAtsAssessmentSnapshots(
  snapshots: AtsAssessmentSnapshot[], currentRevision: number,
): AtsAssessmentComparison | null {
  if (snapshots.length < 2 || snapshots[0].career_revision !== currentRevision) return null;
  const [after, before] = snapshots;
  if (!Array.isArray(after.breakdown) || !Array.isArray(before.breakdown) ||
      after.algorithm_version !== before.algorithm_version) return null;
  const earlier = new Map(before.breakdown.map((item) => [item.dimension, item]));
  const improvements = after.breakdown.flatMap((item) => {
    const prior = earlier.get(item.dimension);
    return prior && item.score > prior.score ? [{
      dimension: item.dimension, label: item.label, before: prior.score,
      after: item.score, delta: item.score - prior.score, explanation: item.reason,
    }] : [];
  });
  return {
    algorithmVersion: after.algorithm_version,
    before: { score: before.score, revision: before.career_revision, assessedAt: before.assessed_at },
    after: { score: after.score, revision: after.career_revision, assessedAt: after.assessed_at },
    improvements,
  };
}
