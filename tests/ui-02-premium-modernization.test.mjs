import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("reference inventory records the unavailable approved root and all eleven generator boundaries", () => {
  const inventory = read("docs/DESIGN_REFERENCE_INVENTORY.md");
  assert.match(inventory, /C:\\Development\\zevantaa-design-references/);
  assert.match(inventory, /directory does not exist/i);
  for (const output of [
    "global-ats-resume", "domestic-resume-1", "domestic-resume-2", "domestic-resume-3",
    "domestic-resume-4", "domestic-resume-5", "gcc-resume", "europass-eu-resume",
    "general-corporate-cover-letter", "international-relocation-cover-letter",
    "technology-startup-cover-letter",
  ]) assert.ok(inventory.includes("| `" + output + "` |"), output);
});

test("priority screens consume one accessible shared page-header system", () => {
  const header = read("src/components/ui/page-header.tsx");
  assert.match(header, /<header/);
  assert.match(header, /<h1 className="type-heading-1">/);
  assert.match(header, /premium-page-header__actions/);
  for (const path of [
    "src/features/admin-portal/admin-directory-workspace.tsx",
    "src/features/admin-portal/create-client-account-page.tsx",
    "src/features/admin-portal/edit-client-account-page.tsx",
    "src/features/client-portal/client-dashboard-page.tsx",
    "src/features/client-portal/client-profile-page.tsx",
    "src/features/client-portal/client-document-workspace.tsx",
    "src/app/client/career-profile/page.tsx",
    "src/app/client/ats/page.tsx",
  ]) assert.match(read(path), /<PageHeader/);
});

test("shell interactions provide immediate navigation, keyboard and scroll feedback", () => {
  const shell = read("src/components/dashboard/dashboard-shell.tsx");
  const css = read("src/app/globals.css");
  assert.match(shell, /pendingHref/);
  assert.match(shell, /aria-live="polite"/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /passive: true/);
  assert.match(shell, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.dashboard-navigation-progress/);
  assert.match(css, /\.dashboard-scroll-top--visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.dashboard-navigation-progress__bar[\s\S]*?animation:\s*none/);
});

test("ATS presentation uses the genuine calculated value for accessible progress", () => {
  const panel = read("src/features/document-generation/indicative-ats-panel.tsx");
  assert.match(panel, /result\.score \* 3\.6/);
  assert.match(panel, /role=\{result\.status === "ready" \? "progressbar" : "status"\}/);
  assert.match(panel, /aria-valuenow=\{result\.status === "ready" \? result\.score/);
  assert.match(panel, /<meter[^>]*max=\{item\.maximum\}[^>]*value=\{item\.score\}/);
});

test("premium motion remains bounded to CSS and reduced-motion safe", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /--motion-duration-fast:/);
  assert.match(css, /@media \(hover: hover\)/);
  assert.match(css, /\.client-intake-file-block:focus-within/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?scroll-behavior:\s*auto/);
});
