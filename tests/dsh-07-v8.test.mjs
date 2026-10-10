import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { toCareerDraft } = await import("../src/features/client-portal/career-profile-model.ts");
const { validateCareerDraft } = await import("../src/features/client-portal/career-profile-validation.ts");
const { normalizeSkillName } = await import("../src/features/client-portal/skill-name.ts");
const { BRAND_DEFAULTS } = await import("../src/features/branding/brand-settings-config.ts");
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const fixture = () => toCareerDraft(createLongGlobalAtsQaProfile());

test("v8 optional work, education, certification and project values may remain blank", () => {
  const draft = fixture();
  draft.workExperience[0].employmentType = "";
  draft.workExperience[0].startDate = "";
  draft.education[0].modeOfStudy = "";
  draft.certifications[0].validityStatus = "";
  draft.projects[0].ongoing = false;
  const valid = validateCareerDraft(draft);
  assert.equal(valid.workExperience[0].startDate, "");
  assert.equal(valid.education[0].modeOfStudy, "");
  assert.equal(valid.certifications[0].validityStatus, "");
});

test("v8 controlled choices and current/ongoing dates fail closed", () => {
  const draft = fixture();
  draft.workExperience[0].employmentType = "permanent-ish";
  assert.throws(() => validateCareerDraft(draft), /listed|choose|employment/i);
  draft.workExperience[0].employmentType = "contract";
  draft.education[0].modeOfStudy = "";
  assert.equal(validateCareerDraft(draft).workExperience[0].employmentType, "contract");
  draft.education[0].modeOfStudy = "remote-ish";
  assert.throws(() => validateCareerDraft(draft), /listed|choose|study/i);
  draft.education[0].modeOfStudy = "online";
  draft.projects[0].ongoing = true;
  draft.projects[0].endDate = "2025-01";
  assert.throws(() => validateCareerDraft(draft), /ongoing project/i);
});

test("certification exact date and validity require explicit non-inferred expiry", () => {
  const draft = fixture();
  draft.certifications[0].issuedOn = "";
  draft.certifications[0].issueYear = "";
  draft.certifications[0].issuedExactOn = "2021-03-18";
  draft.certifications[0].validityStatus = "until-date";
  draft.certifications[0].expiryYear = "";
  assert.throws(() => validateCareerDraft(draft), /exact expiry date/i);
  draft.certifications[0].expiresExactOn = "2026-03-18";
  assert.equal(validateCareerDraft(draft).certifications[0].expiresExactOn, "2026-03-18");
  draft.certifications[0].expiresExactOn = "";
  draft.certifications[0].validityStatus = "no-expiry";
  assert.equal(validateCareerDraft(draft).certifications[0].expiresExactOn, "");
});

test("skill aliases normalize deterministically and duplicate aliases are rejected", () => {
  assert.deepEqual(normalizeSkillName(" MS Excel "), { name: "Microsoft Excel", key: "microsoft-excel" });
  assert.deepEqual(normalizeSkillName("Excel"), normalizeSkillName("Microsoft Excel"));
  const draft = fixture();
  draft.skills[0].name = "MS Excel";
  draft.skills[1].name = "Excel";
  assert.throws(() => validateCareerDraft(draft), /duplicate names/i);
});

test("editor exposes section/child selection and explicit add-delete for each repeating group", () => {
  const editor = source("src/features/client-portal/client-career-editor.tsx");
  for (const section of ["workExperience", "education", "certifications", "projects"])
    assert.match(editor, new RegExp(section));
  for (const behavior of ["setSelected(row.key)", "setSelected(row.key);", "addRow(section as CareerSection)",
    "removeRow(section as CareerSection, activeRow.key)", "career-v8-save-bar", "Search skill library", "Add custom skill"])
    assert.ok(editor.includes(behavior), behavior);
});

test("calendar has anchored scroll/resize positioning and keyboard dismissal", () => {
  const picker = source("src/features/client-portal/career-date-picker.tsx");
  for (const behavior of ["getBoundingClientRect", 'addEventListener("scroll"', 'addEventListener("resize"',
    "rect.bottom < 0", 'event.key === "Escape"', 'role="dialog"', 'stage === "decade"'])
    assert.ok(picker.includes(behavior), behavior);
});

test("appearance uses an admin gate, private bucket, and built-in fallback", () => {
  assert.equal(BRAND_DEFAULTS.logoObjectKey, null);
  assert.match(source("src/features/branding/save-brand-settings-action.ts"), /requireApplicationRole\("admin"\)/);
  assert.match(source("src/app/admin/appearance/page.tsx"), /getBrandSettings/);
  const migration = source("supabase/migrations/20261010203200_dsh_07_v8_editor_and_brand_settings.sql");
  assert.match(migration, /'zevantaa-brand-assets', false/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.app_brand_settings from public, anon, authenticated/);
  assert.match(source("src/features/branding/brand-settings-service.ts"), /return BRAND_DEFAULTS/);
});

test("v8 save remains linked, revision-checked, and excludes admin-owned fields", () => {
  const service = source("src/features/client-portal/career-profile-service.ts");
  const action = source("src/features/client-portal/save-career-profile-action.ts");
  assert.match(service, /resolveLinkedClientProfile/);
  assert.match(service, /apply_client_career_profile_v8/);
  assert.match(service, /snapshot\.revision !== expectedRevision/);
  assert.match(action, /validateCareerDraft/);
  assert.doesNotMatch(source("src/features/client-portal/career-profile-model.ts"), /selectedPackage:/);
});
