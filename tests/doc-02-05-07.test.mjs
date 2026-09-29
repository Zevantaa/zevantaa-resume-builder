import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      "@/features/authentication/authorization": "export async function requireApplicationRole(role){return globalThis.__reviewTest.requireRole(role)}",
      "@/lib/supabase/admin": "export function createSupabaseAdminClient(){return globalThis.__reviewTest.adminClient()}",
      "./admin-resume-review-service": "export async function getAdminResumeReview(id){return globalThis.__reviewTest.getReview(id)}",
    };
    if (specifier in mocks) return { url: mock(mocks[specifier]), shortCircuit: true };
    if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { parseResumeReview } = await import("../src/features/document-generation/resume-review-parser.ts");
const { confirmResumeReviewAction } = await import("../src/features/document-generation/confirm-resume-review-action.ts");
const text = `Professional Summary\nFictional operations analyst.\n\nEmployment History\nAnalyst | Imaginary Harbour Ltd | 2020-01 – 2023-04\nManager | Fictional Blue Kite | 2023-05 – Present\n\nEducation\nBSc Computing | Fictional North College | 2016-09 – 2019-06\n\nSkills\nReporting, Process design\n\nCertifications\nSafety Certificate | Fictional Skills Board | 2022-03\n\nLanguages\nEnglish, Hindi\n\nProjects\nProject: Fictional reporting project\n\nAdditional Information\nVolunteer work`;

test("recognized sections map to ordered review proposals without invented fields", () => {
  const draft = parseResumeReview(text);
  assert.deepEqual(draft.proposals.map(({ section }) => section), [
    "summary", "employment", "employment", "education", "skills", "skills",
    "certifications", "languages", "languages", "projects", "additional",
  ]);
  assert.deepEqual(draft.proposals[1].fields, {
    jobTitle: "Analyst", employerName: "Imaginary Harbour Ltd", startDate: "2020-01", endDate: "2023-04", isCurrentRole: "false",
  });
  assert.equal(draft.proposals[2].fields.isCurrentRole, "true");
  assert.equal(draft.proposals[2].fields.endDate, "");
  assert.equal(draft.proposals[3].fields.qualification, "BSc Computing");
  assert.equal(draft.proposals[6].fields.issuingOrganization, "Fictional Skills Board");
  assert.deepEqual(draft.proposals[0].sourceLines, [2]);
});

test("ambiguous dates, partial entries, missing headings and duplicate headings warn without fabricating facts", () => {
  const draft = parseResumeReview("Experience\nEngineer | Imaginary Co | Spring 2020 to 2022\nEngineer only\nSkills\nReporting\nSkills\nAnalysis");
  assert.equal(draft.proposals.some((item) => item.section === "employment"), false);
  assert.ok(draft.warnings.some((warning) => warning.includes("ambiguous")));
  assert.ok(draft.warnings.some((warning) => warning.includes("Repeated skills")));
  assert.equal(parseResumeReview("Fictional person with an unclear resume").proposals.length, 0);
  assert.equal(parseResumeReview("Summary\nA supplied sentence only").proposals[0].fields.text, "A supplied sentence only");
  const unusual = parseResumeReview("Education\nDegree | Imaginary College | Spring 2019\nCertifications\nSafety | Fictional Board | April 2022");
  assert.equal(unusual.proposals.length, 0);
  assert.ok(unusual.warnings.some((warning) => warning.includes("education line")));
});

const fixtureReview = () => {
  const draft = parseResumeReview(text);
  return {
    client: { candidateProfileId: "profile-1" },
    extraction: { status: "success", sourceFileId: "file-1", extractor: "mammoth" },
    sourceHash: "a".repeat(64), draft, priorReview: null,
  };
};
function form(review, selected = [review.draft.proposals[0]]) {
  const data = new FormData();
  data.set("sourceHash", review.sourceHash);
  data.set("confirmReview", "yes");
  for (const proposal of selected) {
    data.set(`accept:${proposal.id}`, "on");
    for (const [key, value] of Object.entries(proposal.fields)) data.set(`field:${proposal.id}:${key}`, value);
  }
  return data;
}
function setup() {
  const calls = [];
  const review = fixtureReview();
  globalThis.__reviewTest = {
    requireRole: async (role) => { calls.push({ role }); return { userId: "admin-1" }; },
    getReview: async (id) => { calls.push({ reviewFor: id }); return review; },
    adminClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } }),
  };
  return { calls, review };
}

test("explicit confirmation and source hash are required before any persistence", async () => {
  const { calls, review } = setup();
  const data = form(review);
  data.delete("confirmReview");
  assert.equal((await confirmResumeReviewAction("client-1", {}, data)).ok, false);
  data.set("confirmReview", "yes"); data.set("sourceHash", "stale");
  assert.equal((await confirmResumeReviewAction("client-1", {}, data)).ok, false);
  assert.equal(calls.some((call) => call.name === "confirm_resume_review"), false);
});

test("approved canonical data uses server-resolved profile/file IDs, never browser ownership fields", async () => {
  const { calls, review } = setup();
  const data = form(review, [review.draft.proposals[0], review.draft.proposals[1]]);
  data.set("candidateProfileId", "forged-profile"); data.set("sourceFileId", "forged-file");
  data.set("field:summary:0:text", "Administrator-reviewed fictional summary");
  assert.equal((await confirmResumeReviewAction("client-1", {}, data)).ok, true);
  const rpc = calls.find((call) => call.name === "confirm_resume_review");
  assert.equal(rpc.args.p_profile_id, "profile-1");
  assert.equal(rpc.args.p_source_file_id, "file-1");
  assert.equal(rpc.args.p_approved.length, 2);
  assert.equal(rpc.args.p_approved[0].fields.text, "Administrator-reviewed fictional summary");
  assert.equal("candidateProfileId" in rpc.args.p_approved[0], false);
});

test("client role denial stops review/save before privileged access", async () => {
  const { calls, review } = setup();
  globalThis.__reviewTest.requireRole = async () => { throw new Error("access-denied"); };
  await assert.rejects(confirmResumeReviewAction("client-1", {}, form(review)), /access-denied/);
  assert.deepEqual(calls, []);
});

test("failed extraction, prior review, and invalid edited date never persist", async () => {
  const { calls, review } = setup();
  review.extraction.status = "failed";
  assert.equal((await confirmResumeReviewAction("client-1", {}, form(review))).ok, false);
  review.extraction.status = "success"; review.priorReview = { id: "review-1" };
  assert.equal((await confirmResumeReviewAction("client-1", {}, form(review))).ok, false);
  review.priorReview = null;
  const data = form(review, [review.draft.proposals[1]]);
  data.set(`field:${review.draft.proposals[1].id}:startDate`, "Spring 2020");
  assert.equal((await confirmResumeReviewAction("client-1", {}, data)).ok, false);
  assert.equal(calls.some((call) => call.name === "confirm_resume_review"), false);
});

test("migration persists provenance and canonical resume sections but never admin-owned contact fields", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260929000200_doc_02_05_06_review_confirmation.sql", import.meta.url), "utf8");
  for (const table of ["profile_work_experiences", "profile_education_entries", "profile_skills", "profile_certifications", "profile_languages", "profile_projects", "additional_profile_sections"]) {
    assert.match(sql, new RegExp(`insert into public\\.${table}\\(`));
  }
  assert.match(sql, /existing_resume_file_id = p_source_file_id/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on function public\.confirm_resume_review/);
  assert.doesNotMatch(sql, /update public\.candidate_profiles set (?:full_name|primary_email|mobile_number|whatsapp_number|linkedin_url|current_location|relocation_preference|selected_package_code)/);
});
