import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { V1_PACKAGE_DEFINITIONS } = await import("../src/types/package.ts");
const { V1_DOCUMENT_OUTPUTS, getPackageRouting, getAllowedOutputsForPackage,
  getUnavailableOutputsForPackage, packageAllowsOutput, isAtsScoreVisible,
  isGccPhotoAvailable } = await import("../src/features/document-generation/package-routing.ts");

const A = "global-ats-resume";
const D = [1, 2, 3, 4, 5].map((number) => `domestic-resume-${number}`);
const G = "gcc-resume";
const E = "europass-eu-resume";
const C = ["general-corporate-cover-letter", "international-relocation-cover-letter", "technology-startup-cover-letter"];
const matrix = [
  ["indian-domestic", [A, ...D]],
  ["gcc-middle-east", [A, G]],
  ["europass-european-union", [A, E]],
  ["domestic-gcc", [A, ...D, G]],
  ["domestic-europass-european-union", [A, ...D, E]],
  ["global-mobility-master", [A, ...D, G, E]],
  ["executive-transition-agency-distribution", [A, ...D, G, E, ...C]],
];

test("frozen seven-package by eleven-output matrix is exact and ordered", () => {
  assert.deepEqual(V1_PACKAGE_DEFINITIONS.map((item) => item.code), matrix.map(([code]) => code));
  assert.equal(V1_DOCUMENT_OUTPUTS.length, 11);
  for (const [code, expected] of matrix) {
    assert.deepEqual(getAllowedOutputsForPackage(code), expected, code);
    assert.deepEqual(getUnavailableOutputsForPackage(code), V1_DOCUMENT_OUTPUTS.filter((output) => !expected.includes(output)));
    assert.deepEqual(getPackageRouting(code).allowedOutputs, expected);
    for (const output of V1_DOCUMENT_OUTPUTS) {
      assert.equal(packageAllowsOutput(code, output), expected.includes(output), `${code}: ${output}`);
    }
  }
});

test("combination outputs are exact unions; only Executive includes cover letters", () => {
  const allowed = (code) => new Set(getAllowedOutputsForPackage(code));
  assert.deepEqual(allowed("domestic-gcc"), new Set([...allowed("indian-domestic"), ...allowed("gcc-middle-east")]));
  assert.deepEqual(allowed("domestic-europass-european-union"), new Set([...allowed("indian-domestic"), ...allowed("europass-european-union")]));
  assert.deepEqual(allowed("global-mobility-master"), new Set([...allowed("domestic-gcc"), ...allowed("europass-european-union")]));
  assert.deepEqual(getAllowedOutputsForPackage("executive-transition-agency-distribution"), V1_DOCUMENT_OUTPUTS);
  for (const [code] of matrix.slice(0, 6)) for (const output of C) assert.equal(packageAllowsOutput(code, output), false);
});

test("unknown, null, malformed and retired package values fail closed", () => {
  for (const code of [null, undefined, "", "not-a-package", {}, [], 7, "INDIAN-DOMESTIC"]) {
    assert.equal(getPackageRouting(code), null);
    assert.deepEqual(getAllowedOutputsForPackage(code), []);
    assert.deepEqual(getUnavailableOutputsForPackage(code), V1_DOCUMENT_OUTPUTS);
    assert.equal(isAtsScoreVisible(code), false);
    assert.equal(isGccPhotoAvailable(code), false);
    for (const output of V1_DOCUMENT_OUTPUTS) assert.equal(packageAllowsOutput(code, output), false);
  }
  assert.equal(packageAllowsOutput("indian-domestic", "unknown-output"), false);
});

test("UI capability flags match the same server-side output permissions", () => {
  for (const [code] of matrix) {
    assert.equal(isAtsScoreVisible(code), packageAllowsOutput(code, A));
    assert.equal(isGccPhotoAvailable(code), packageAllowsOutput(code, G));
  }
  assert.deepEqual(matrix.filter(([code]) => isGccPhotoAvailable(code)).map(([code]) => code),
    ["gcc-middle-east", "domestic-gcc", "global-mobility-master", "executive-transition-agency-distribution"]);
});

test("all five protected download routes enforce the canonical entitlement after profile reload", () => {
  const roots = ["global-ats", "domestic-resumes", "gcc-resume", "european-resume", "cover-letters"];
  for (const root of roots) {
    const source = readFileSync(new URL(`../src/app/admin/clients/[userId]/${root}/download/route.ts`, import.meta.url), "utf8");
    assert.match(source, /loadAdminCandidateProfile\(userId\)/);
    assert.match(source, /packageAllowsOutput\(profile\.selectedPackage,/);
    assert.match(source, /Cross-origin PDF requests are not allowed/);
    assert.match(source, /renderPdfDownloadResponse/);
  }
});

test("admin and client output navigation consumes shared package visibility", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("src/features/admin-portal/edit-client-account-page.tsx"), /packageAllowsOutput\(client\.packageCode,/);
  assert.match(read("src/features/client-portal/client-dashboard-view.ts"), /getPackageRouting\(summary\.packageCode\)/);
  assert.match(read("src/features/client-portal/client-intake-form.tsx"), /isGccPhotoAvailable\(details\.selectedPackageCode\)/);
  assert.match(read("src/features/client-portal/client-intake-service.ts"), /values\.photo && !isGccPhotoAvailable\(profile\.selected_package_code\)/);
});
