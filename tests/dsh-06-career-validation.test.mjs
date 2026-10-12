import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { toCareerDraft } = await import("../src/features/client-portal/career-profile-model.ts");
const { validateCareerDraft, CareerValidationError } = await import("../src/features/client-portal/career-profile-validation.ts");
const fixture = () => toCareerDraft(createLongGlobalAtsQaProfile());
const newKey = "new-77777777-7777-4777-8777-777777777777";

test("projection exposes career fields but no profile ID or admin-owned identity fields", () => {
  const draft = fixture();
  assert.equal(draft.workExperience.length, 6);
  assert.equal(draft.skills.length, 24);
  for (const forbidden of ["id", "fullName", "primaryEmail", "mobileNumber", "whatsappNumber", "linkedinUrl", "currentLocation", "relocationPreference", "selectedPackage", "targetMarkets"]) {
    assert.equal(Object.hasOwn(draft, forbidden), false, forbidden);
  }
  assert.equal(JSON.stringify(draft).includes(createLongGlobalAtsQaProfile().id), false);
});

test("full canonical fixture validates with exact year-only certification and education dates", () => {
  const result = validateCareerDraft(fixture());
  assert.equal(result.education[0].completionYear, "2017");
  assert.equal(result.certifications[0].issueYear, "2021");
  assert.equal(result.certifications[0].issuedOn, "");
  assert.equal(result.languages[0].proficiency, "fluent");
});

test("summary, work, skills, education and certification changes normalize without inventing facts", () => {
  const draft = fixture();
  draft.professionalSummary = "  Candidate-supplied operations update.  ";
  draft.workExperience[0].jobTitle = "  Updated Operations Lead  ";
  draft.skills[0].name = "  Inventory planning  ";
  draft.education[0].gradeResult = "  CGPA: 8.1/10  ";
  draft.certifications[0].issueYear = "2022";
  const result = validateCareerDraft(draft);
  assert.equal(result.professionalSummary, "Candidate-supplied operations update.");
  assert.equal(result.workExperience[0].jobTitle, "Updated Operations Lead");
  assert.equal(result.skills[0].name, "Inventory planning");
  assert.equal(result.education[0].gradeResult, "CGPA: 8.1/10");
  assert.equal(result.certifications[0].issueYear, "2022");
});

test("blank optional rows and sections are omitted", () => {
  const draft = fixture();
  draft.skills.push({ key: newKey, name: "", category: "" });
  draft.additionalSections.push({ key: newKey, title: "", items: [] });
  assert.equal(validateCareerDraft(draft).skills.length, 24);
  assert.equal(validateCareerDraft(draft).additionalSections.length, 1);
});

test("required work entry fields and current-role end-date rule fail closed", () => {
  const draft = fixture();
  draft.workExperience[0].employerName = "";
  assert.throws(() => validateCareerDraft(draft), CareerValidationError);
  draft.workExperience[0].employerName = "Fictional Employer";
  draft.workExperience[0].currentRole = true;
  assert.throws(() => validateCareerDraft(draft), /current role cannot have an end month/i);
});

test("invalid chronology and malformed months are rejected", () => {
  const draft = fixture();
  draft.workExperience[0].endDate = "2013-01";
  assert.throws(() => validateCareerDraft(draft), /end date cannot precede/i);
  draft.workExperience[0].endDate = "2014-12";
  draft.projects[0].startDate = "2021-13";
  assert.throws(() => validateCareerDraft(draft), /valid YYYY-MM/i);
});

test("education year/month conflict and certification chronology fail closed", () => {
  const draft = fixture();
  draft.education[0].endDate = "2017-05";
  assert.throws(() => validateCareerDraft(draft), /both a completion year and end month/i);
  draft.education[0].endDate = "";
  draft.certifications[0].expiryYear = "2020";
  assert.throws(() => validateCareerDraft(draft), /expiry cannot precede/i);
});

test("duplicate and blank skills are not persisted as entries", () => {
  const draft = fixture();
  draft.skills[1].name = draft.skills[0].name.toUpperCase();
  assert.throws(() => validateCareerDraft(draft), /duplicate names/i);
  draft.skills[1].name = "";
  draft.skills[1].category = "Category only";
  assert.throws(() => validateCareerDraft(draft), /Skill is required/i);
});

test("language proficiency is only accepted exactly from canonical values", () => {
  const draft = fixture();
  draft.languages[0].proficiency = "CEFR C2";
  assert.throws(() => validateCareerDraft(draft), /listed proficiency/i);
  draft.languages[0].proficiency = "";
  assert.equal(validateCareerDraft(draft).languages[0].proficiency, "");
});

test("project URL and long text limits are validated", () => {
  const draft = fixture();
  draft.projects[0].url = "javascript:alert(1)";
  assert.throws(() => validateCareerDraft(draft), /HTTP or HTTPS URL/i);
  draft.projects[0].url = "";
  draft.projects[0].name = "x".repeat(201);
  assert.throws(() => validateCareerDraft(draft), /too long/i);
});

test("all admin-owned and unexpected nested fields are rejected", () => {
  for (const key of ["profileId", "fullName", "primaryEmail", "mobileNumber", "whatsappNumber", "linkedinUrl", "currentLocation", "relocationPreference", "selectedPackage", "packageCode", "storageObjectKey"]) {
    const draft = fixture();
    draft[key] = "forged";
    assert.throws(() => validateCareerDraft(draft), /cannot be changed here/i, key);
  }
  const draft = fixture();
  draft.workExperience[0].candidate_profile_id = "another-profile";
  assert.throws(() => validateCareerDraft(draft), /cannot be changed here/i);
});

test("malformed entry keys, duplicates, and oversized arrays are rejected", () => {
  const draft = fixture();
  draft.workExperience[0].key = "../../other-client";
  assert.throws(() => validateCareerDraft(draft), /refresh and try again/i);
  draft.workExperience[0].key = draft.workExperience[1].key;
  assert.throws(() => validateCareerDraft(draft), /duplicate form entry/i);
  draft.workExperience = Array.from({ length: 51 }, () => ({ key: newKey, jobTitle: "Role", employerName: "Employer", startDate: "2020-01", endDate: "", currentRole: true, location: "", description: "", highlights: "" }));
  assert.throws(() => validateCareerDraft(draft), /too many/i);
});

test("protected layout, server action and SQL RPC remain role-gated", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("src/app/client/layout.tsx"), /requireApplicationRole\("client"\)/);
  assert.match(read("src/features/client-portal/save-career-profile-action.ts"), /requireApplicationRole\("client"\)/);
  assert.match(read("src/features/client-portal/career-profile-service.ts"), /resolveLinkedClientProfile\(\)/);
  const sql = read("supabase/migrations/20261010184016_dsh_06_dynamic_career_updates.sql");
  assert.match(sql, /role_code = 'client' and account_status = 'active'/);
  assert.match(sql, /candidate_profile_id = p_profile_id/);
  assert.match(sql, /v_revision <> p_expected_revision/);
  assert.match(sql, /grant execute on function public.apply_client_career_profile.*to service_role/s);
  assert.doesNotMatch(sql, /^grant execute on function public\.apply_client_career_profile.*to authenticated;/m);
});
