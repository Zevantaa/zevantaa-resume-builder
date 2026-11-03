import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { compareAtsAssessmentSnapshots } = await import("../src/features/document-generation/ats-assessment-comparison.ts");
const { ATS_ALGORITHM_VERSION, ATS_SCORE_WEIGHTS } = await import("../src/features/document-generation/indicative-ats-score.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function breakdown(overrides = {}) {
  return Object.entries(ATS_SCORE_WEIGHTS).map(([dimension, maximum]) => ({
    dimension, label: dimension, maximum, score: overrides[dimension] ?? 0,
    reason: `${dimension} measured from canonical fields.`,
  }));
}

test("recorded revision comparison reports only genuine measured improvements", () => {
  const result = compareAtsAssessmentSnapshots([
    { career_revision: 9, algorithm_version: ATS_ALGORITHM_VERSION, score: 65,
      breakdown: breakdown({ summary: 10, skills: 15, experience: 25, contact: 15 }), assessed_at: "2026-11-04T02:00:00Z" },
    { career_revision: 4, algorithm_version: ATS_ALGORITHM_VERSION, score: 50,
      breakdown: breakdown({ summary: 5, skills: 5, experience: 25, contact: 15 }), assessed_at: "2026-11-03T02:00:00Z" },
  ], 9);
  assert.deepEqual({ before: result.before.score, after: result.after.score }, { before: 50, after: 65 });
  assert.deepEqual(result.improvements.map((item) => [item.dimension, item.delta]), [["summary", 5], ["skills", 10]]);
  assert.ok(result.improvements.every((item) => item.explanation.includes("canonical fields")));
});

test("comparison is withheld for stale or cross-version snapshots", () => {
  const snapshots = [
    { career_revision: 2, algorithm_version: ATS_ALGORITHM_VERSION, score: 50, breakdown: breakdown(), assessed_at: "now" },
    { career_revision: 1, algorithm_version: ATS_ALGORITHM_VERSION, score: 50, breakdown: breakdown(), assessed_at: "before" },
  ];
  assert.equal(compareAtsAssessmentSnapshots(snapshots, 3), null);
  assert.equal(compareAtsAssessmentSnapshots([{ ...snapshots[0], algorithm_version: "v2" }, snapshots[1]], 2), null);
});

test("ATS provenance migration is private, revision-bound and deterministic", () => {
  const sql = read("supabase/migrations/20261103223240_ats_assessment_provenance.sql");
  assert.match(sql, /algorithm_version = 'zevantaa-indicative-ats-v1'/i);
  assert.match(sql, /unique \(candidate_profile_id, career_revision, algorithm_version\)/i);
  assert.match(sql, /sum\(\(item->>'score'\)::integer\)[\s\S]*<> p_score/i);
  assert.match(sql, /p\.career_revision = p_career_revision/i);
  assert.match(sql, /ATS assessment is non-deterministic for this revision/i);
  assert.match(sql, /alter table public\.ats_assessment_snapshots enable row level security/i);
  assert.match(sql, /revoke all on public\.ats_assessment_snapshots from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /professional_summary|raw_text|resume_text/i);
});

test("generation records provenance and UI retains the indicative disclaimer", () => {
  assert.match(read("src/features/document-generation/persistent-document-service.ts"), /recordIndicativeAtsAssessment/);
  const panel = read("src/features/document-generation/indicative-ats-panel.tsx");
  assert.match(panel, /not a third-party ATS guarantee/i);
  assert.match(panel, /genuine calculations from the saved canonical profile/i);
  assert.match(panel, /comparison\.improvements/);
  assert.doesNotMatch(panel, /minimum 90|guaranteed 90|fabricated/i);
});
