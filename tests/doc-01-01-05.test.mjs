import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");
const migrationDir = path.join(root, "supabase/migrations");
const migrations = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => read(`supabase/migrations/${name}`));
const schema = read("supabase/migrations/20260917000100_fnd_03_06_initial_v1_schema.sql");
const relations = read("supabase/migrations/20260918042037_fnd_03_07_relationships_and_constraints.sql");
const docMigration = read("supabase/migrations/20260928000100_doc_01_01_05_profile_model_integrity.sql");
const model = read("src/types/client-profile.ts");
const seed = read("supabase/seed.sql");

function insertBlock(table) {
  const match = seed.match(new RegExp(`insert into public\\.${table} \\([\\s\\S]*?on conflict do nothing;`, "i"));
  assert.ok(match, `${table} seed insert exists`);
  return match[0];
}

test("one canonical parent and child table set; no parallel DOC tables", () => {
  for (const table of ["candidate_profiles", "profile_work_experiences", "profile_education_entries", "profile_skills", "profile_certifications"]) {
    const count = migrations.reduce((total, sql) => total + [...sql.matchAll(new RegExp(`create table public\\.${table}\\s*\\(`, "gi"))].length, 0);
    assert.equal(count, 1, `${table} is defined once`);
  }
  assert.doesNotMatch(docMigration, /create\s+table/i);
  assert.match(model, /interface CandidateProfile extends TimestampAuditFields/);
  for (const section of ["workExperience", "education", "skills", "certifications", "languages", "projects", "additionalSections"]) {
    assert.match(model, new RegExp(`\\b${section}:`));
  }
});

test("all four DOC children retain profile FK and ordered lookup", () => {
  for (const table of ["profile_work_experiences", "profile_education_entries", "profile_skills", "profile_certifications"]) {
    assert.match(schema, new RegExp(`create table public\\.${table} \\([\\s\\S]*?candidate_profile_id uuid not null`));
    assert.match(relations, new RegExp(`${table}_candidate_profile_fk[\\s\\S]*?foreign key \\(candidate_profile_id\\)[\\s\\S]*?on delete restrict`));
    assert.match(relations, new RegExp(`on public\\.${table} \\(candidate_profile_id, sort_order\\)`));
  }
});

test("employment separates responsibilities from achievements and validates current role/month order", () => {
  assert.match(model, /interface WorkExperienceEntry[\s\S]*?description\?: string;[\s\S]*?highlights: string\[\]/);
  assert.match(relations, /profile_work_experiences_current_role_check[\s\S]*?not is_current_role or end_date is null/);
  assert.match(docMigration, /profile_work_experiences_months_check[\s\S]*?end_date collate "C" >= start_date collate "C"/);
  assert.match(schema, /create table public\.profile_work_experiences[\s\S]*?start_date text not null/);
});

test("education has optional field, dates, location, result, and ordered highlights", () => {
  assert.match(model, /interface EducationEntry[\s\S]*?fieldOfStudy\?: string;[\s\S]*?gradeResult\?: string;[\s\S]*?highlights: string\[\]/);
  assert.match(docMigration, /alter table public\.profile_education_entries\s+add column grade_result text/);
  assert.match(docMigration, /profile_education_entries_months_check[\s\S]*?end_date collate "C" >= start_date collate "C"/);
  for (const field of ["institution_name text not null", "qualification text not null", "field_of_study text", "location text", "sort_order integer not null"]) {
    assert.ok(schema.includes(field));
  }
});

test("skills remain minimal keyword/category entries, without invented proficiency", () => {
  assert.match(model, /interface SkillEntry[\s\S]*?name: string;\s+category\?: string;/);
  assert.match(schema, /create table public\.profile_skills[\s\S]*?name text not null,\s+category text/);
  assert.doesNotMatch(docMigration, /alter table public\.profile_skills/);
});

test("certifications retain issuer and credentials with valid issue/expiry chronology", () => {
  assert.match(model, /interface CertificationEntry[\s\S]*?issuingOrganization: string;[\s\S]*?issuedOn\?: YearMonth;[\s\S]*?expiresOn\?: YearMonth;[\s\S]*?credentialId\?: string;[\s\S]*?credentialUrl\?: string/);
  assert.match(docMigration, /profile_certifications_months_check[\s\S]*?expires_on collate "C" >= issued_on collate "C"/);
});

test("month constraints reject malformed months and reverse chronology; seed months fit", () => {
  const yearMonth = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
  for (const value of ["2024-01", "2026-12"]) assert.match(value, yearMonth);
  for (const value of ["2024-00", "2024-13", "2024-1", "2024", "2024-01-01"]) assert.doesNotMatch(value, yearMonth);
  assert.ok("2024-12" < "2025-01");
  assert.ok("2025-01" > "2024-12");
  for (const table of ["profile_work_experiences", "profile_education_entries", "profile_certifications"]) {
    const months = [...insertBlock(table).matchAll(/'([0-9]{4}-[0-9]{2})'/g)].map((match) => match[1]);
    assert.ok(months.length > 0, `${table} has seeded months`);
    for (const month of months) assert.match(month, yearMonth);
  }
});

test("seeded candidates still have each required child section", () => {
  const expectedRows = new Map([
    ["profile_work_experiences", 6],
    ["profile_education_entries", 3],
    ["profile_skills", 9],
    ["profile_certifications", 3],
  ]);
  for (const [table, expected] of expectedRows) {
    const rows = insertBlock(table).match(/'[4567]0000000-0000-4000-8000-[0-9]{12}'/g) ?? [];
    assert.equal(rows.length, expected, `${table} keeps its fictional seed rows`);
  }
});
