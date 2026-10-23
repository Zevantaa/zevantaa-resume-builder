import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
  if (specifier === "@/lib/supabase/admin") return {
    url: mock("export function createSupabaseAdminClient(){return globalThis.__atsQaDb}"), shortCircuit: true,
  };
  if (specifier === "@/features/authentication/authorization") return {
    url: mock("export async function requireApplicationRole(role){if(role!=='admin') throw new Error('wrong role')}"), shortCircuit: true,
  };
  if (specifier.startsWith("@/types/"))
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { loadCandidateProfileById } = await import("../src/features/document-generation/admin-global-ats-service.ts");
const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { calculateIndicativeAtsScore } = await import("../src/features/document-generation/indicative-ats-score.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const profileId = id(1);
const rows = {
  candidate_profiles: [{ id: profileId, full_name: "Fictional Candidate", primary_email: "fictional@example.invalid",
    mobile_number: "+91 90000 00000", whatsapp_number: null, linkedin_url: null,
    current_location: "Fictional City", relocation_preference: "open", selected_package_code: "indian-domestic",
    target_markets: ["indian-domestic"], professional_summary: null,
    created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", archived_at: null }],
  profile_work_experiences: [
    { id: id(2), candidate_profile_id: profileId, sort_order: 1, employer_name: "Active Fictional Employer",
      job_title: "Coordinator", start_date: "2022-01", end_date: null, is_current_role: true,
      employment_type: null, location: null, description: null, highlights: [], archived_at: null },
    { id: id(3), candidate_profile_id: profileId, sort_order: 0, employer_name: "Archived Fictional Employer",
      job_title: "Director", start_date: "2021-01", end_date: "2022-01", is_current_role: false,
      employment_type: null, location: null, description: "Old detail", highlights: [], archived_at: "2026-09-02T00:00:00Z" },
  ],
  profile_education_entries: [],
  profile_skills: [
    { id: id(4), candidate_profile_id: profileId, sort_order: 1, name: "Scheduling", category: null, archived_at: null },
    ...Array.from({ length: 8 }, (_, index) => ({ id: id(index + 10), candidate_profile_id: profileId,
      sort_order: index + 2, name: `Archived Skill ${index + 1}`, category: null, archived_at: "2026-09-02T00:00:00Z" })),
  ],
  profile_certifications: [], profile_languages: [], profile_projects: [], additional_profile_sections: [],
};

globalThis.__atsQaDb = { from(table) {
  assert.ok(Object.hasOwn(rows, table), `unexpected table ${table}`);
  const filters = [];
  const query = {
    select() { return this; },
    eq(key, value) { filters.push((row) => row[key] === value); return this; },
    is(key, value) { filters.push((row) => row[key] === value); return this; },
    order() { return this; },
    in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
    async maybeSingle() { return { data: rows[table].filter((row) => filters.every((filter) => filter(row)))[0] ?? null, error: null }; },
    then(resolve) { return Promise.resolve({ data: rows[table].filter((row) => filters.every((filter) => filter(row))), error: null }).then(resolve); },
  };
  return query;
} };

const evaluateFresh = async () => {
  const loaded = await loadCandidateProfileById(profileId);
  return { loaded, score: calculateIndicativeAtsScore(mapCandidateProfileToDocumentData(loaded, "resume")) };
};

test("ATS loader excludes archived career rows and recalculates from latest active rows", async () => {
  const before = await evaluateFresh();
  assert.deepEqual(before.loaded.workExperience.map((row) => row.jobTitle), ["Coordinator"]);
  assert.deepEqual(before.loaded.skills.map((row) => row.name), ["Scheduling"]);
  assert.equal(before.score.status, "ready");
  assert.equal(before.score.breakdown.find((part) => part.dimension === "skills").score, 5);

  rows.profile_skills.push({ id: id(30), candidate_profile_id: profileId, sort_order: 2,
    name: "Inventory Planning", category: null, archived_at: null },
  { id: id(31), candidate_profile_id: profileId, sort_order: 3, name: "Supplier Reporting", category: null, archived_at: null },
  { id: id(32), candidate_profile_id: profileId, sort_order: 4, name: "Forecasting", category: null, archived_at: null });
  const after = await evaluateFresh();
  assert.equal(after.score.status, "ready");
  assert.equal(after.score.breakdown.find((part) => part.dimension === "skills").score, 10);
  assert.ok(after.score.score > before.score.score);
  assert.equal(after.loaded.skills.some((row) => row.name.startsWith("Archived")), false);
});
