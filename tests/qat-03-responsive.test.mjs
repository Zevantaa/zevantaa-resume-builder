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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/app/globals.css");
const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { toCareerDraft } = await import("../src/features/client-portal/career-profile-model.ts");
const { validateCareerDraft } = await import("../src/features/client-portal/career-profile-validation.ts");

test("mobile login grid and controls cannot require a wider intrinsic page track", () => {
  assert.match(css, /\.auth-page\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.auth-shell\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.auth-portal-switch\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
});

test("directory filters collapse at tablet width and directory scroll remains local", () => {
  const directoryCss = css.slice(css.indexOf("/* Master-admin directory"), css.indexOf("/* Structured client career editor"));
  assert.ok(/@media \(min-width: 48rem\)[\s\S]*?\.admin-directory-filters\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(directoryCss), "tablet filters use two columns");
  assert.ok(/@media \(min-width: 64rem\)\s*\{\s*\.admin-directory-filters\s*\{\s*grid-template-columns:/.test(directoryCss), "desktop filters use four columns");
  assert.match(css, /\.table-container\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.admin-directory-table-container\s+\.data-table\s*\{\s*min-width:\s*70rem/s);
  assert.match(read("src/features/admin-portal/admin-directory-workspace.tsx"), /tabIndex=\{0\} aria-label="Client directory; scroll horizontally/);
});

test("mobile uploads, skill search, long entry titles and save area retain usable bounds", () => {
  assert.match(css, /\.client-intake-file-block input\[type="file"\], \.brand-v8-setting input\[type="file"\]\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.career-v8-skill-results\s*\{[^}]*minmax\(min\(100%,\s*12rem\),\s*1fr\)/s);
  assert.match(css, /\.career-v8-entry-head > div\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(css, /\.career-v8-skill-chip\s*\{[^}]*max-width:\s*100%/s);
  assert.match(css, /@media \(max-width: 61rem\)\s*\{[^}]*\.career-v8-editor\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.career-v8-workspace\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/s);
  assert.match(css, /\.career-date-popover\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("career draft supports the requested high-volume navigation scenario", () => {
  const profile = createLongGlobalAtsQaProfile();
  const expand = (rows, count, rename) => Array.from({ length: count }, (_, index) => ({
    ...rows[index % rows.length],
    id: `00000000-0000-4000-8000-${String(index + 200).padStart(12, "0")}`,
    sortOrder: index,
    ...rename(index),
  }));
  profile.workExperience = expand(profile.workExperience, 8, (index) => ({ jobTitle: `Fictional role ${index + 1}` }));
  profile.education = expand(profile.education, 5, (index) => ({ qualification: `Fictional qualification ${index + 1}` }));
  profile.certifications = expand(profile.certifications, 10, (index) => ({ name: `Fictional certificate ${index + 1}` }));
  profile.projects = expand(profile.projects, 10, (index) => ({ name: `Fictional project ${index + 1}` }));
  profile.skills = expand(profile.skills, 26, (index) => ({ name: `Fictional skill ${index + 1}` }));
  const draft = validateCareerDraft(toCareerDraft(profile));
  assert.deepEqual([draft.workExperience.length, draft.education.length, draft.certifications.length,
    draft.projects.length, draft.skills.length], [8, 5, 10, 10, 26]);
  const editor = read("src/features/client-portal/client-career-editor.tsx");
  assert.match(editor, /className="career-v8-section-list"/);
  assert.match(editor, /className="career-v8-child-button"/);
  assert.match(editor, /className="career-v8-save-bar"/);
  assert.match(editor, /Search skill library/);
});

test("mobile PDF and upload actions stay in protected routes, with local status feedback", () => {
  const dashboard = read("src/features/client-portal/client-dashboard-page.tsx");
  const workspace = read("src/features/client-portal/client-document-workspace.tsx");
  const intake = read("src/features/client-portal/client-intake-form.tsx");
  assert.match(dashboard, /href=\{`\/client\/documents\/\$\{item\.documentId\}\/download`\}/);
  assert.match(workspace, /Download PDF/);
  assert.match(intake, /name="resume"/);
  assert.match(intake, /name="photo"/);
  assert.match(intake, /Selected replacement:/);
  assert.match(intake, /Saving files/);
  assert.match(read("src/app/client/documents/[documentId]/download/route.ts"), /downloadCurrentClientDocument/);
});
