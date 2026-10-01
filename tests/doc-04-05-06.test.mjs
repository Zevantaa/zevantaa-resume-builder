import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { calculateIndicativeAtsScore, ATS_BENCHMARK, ATS_SCORE_WEIGHTS } = await import("../src/features/document-generation/indicative-ats-score.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = (n) => ({ id: id(n), sortOrder: n });
function profile() {
  return {
    id: id(1), createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
    fullName: "Fictional Candidate", primaryEmail: "fictional@example.invalid", mobileNumber: "+91 90000 00000",
    currentLocation: "Fictional City", relocationPreference: "open", selectedPackage: "indian-domestic",
    targetMarkets: ["indian-domestic"], workExperience: [], education: [], skills: [], certifications: [],
    languages: [], projects: [], additionalSections: [],
  };
}
const evaluate = (value) => calculateIndicativeAtsScore(mapCandidateProfileToDocumentData(value, "resume"));

test("weights total 100 and benchmark is exactly 90, without a score floor", () => {
  assert.equal(Object.values(ATS_SCORE_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.equal(ATS_BENCHMARK, 90);
  assert.doesNotMatch(read("src/features/document-generation/indicative-ats-score.ts"), /Math\.max\s*\([^,]+,\s*90\)/);
});

test("a sparse but technically ready profile retains a genuinely low score", () => {
  const value = profile();
  value.skills = [{ ...item(2), name: "Scheduling" }];
  value.workExperience = [{ ...item(3), jobTitle: "Coordinator", employerName: "Fictional Employer", startDate: "2022-01", currentRole: true, highlights: [] }];
  const result = evaluate(value);
  assert.equal(result.status, "ready");
  assert.equal(result.score, 50);
  assert.ok(result.score < 90);
  assert.equal(result.band, "below-benchmark");
  assert.ok(result.suggestions.length > 0);
  assert.equal(result.breakdown.length, Object.keys(ATS_SCORE_WEIGHTS).length);
  for (const part of result.breakdown) assert.ok(part.score >= 0 && part.score <= part.maximum);
});

test("fuller verified profile scores higher, can exceed target, and remains deterministic", () => {
  const value = profile();
  value.professionalSummary = "Candidate-supplied operations summary covering documented planning, reporting and coordination responsibilities without invented metrics.";
  value.workExperience = [
    { ...item(3), jobTitle: "Operations Lead", employerName: "Fictional Employer", startDate: "2022-07", currentRole: true, description: "Coordinated reporting.", highlights: [] },
    { ...item(4), jobTitle: "Analyst", employerName: "Example Company", startDate: "2019-01", endDate: "2022-06", currentRole: false, description: "Prepared reports.", highlights: [] },
  ];
  value.education = [{ ...item(5), qualification: "MBA", institutionName: "Fictional University", completionYear: 2018, highlights: [] }];
  value.skills = Array.from({ length: 8 }, (_, index) => ({ ...item(index + 10), name: `Verified skill ${index + 1}` }));
  value.certifications = [{ ...item(20), name: "Verified Certificate", issuingOrganization: "Example Institute", issueYear: 2020 }];
  value.projects = [{ ...item(21), name: "Documented Project", description: "Candidate-supplied project.", highlights: [], technologies: [] }];
  value.languages = [{ ...item(22), name: "English" }];
  const result = evaluate(value);
  assert.equal(result.status, "ready");
  assert.equal(result.score, 100);
  assert.equal(result.band, "meets-benchmark");
  assert.deepEqual(evaluate(value), result);
  assert.ok(result.score > 50 && result.score <= 100);
  assert.equal(result.suggestions.length, 0);
});

test("missing required data produces not-ready, not a misleading number", () => {
  const result = evaluate(profile());
  assert.equal(result.status, "not-ready");
  assert.equal(result.benchmark, 90);
  assert.ok(result.reasons.some((reason) => reason.includes("structured career")));
  assert.equal("score" in result, false);
});

test("skills alone are insufficient for an indicative resume score", () => {
  const value = profile();
  value.skills = [{ ...item(2), name: "Scheduling" }];
  const result = evaluate(value);
  assert.equal(result.status, "not-ready");
  assert.match(result.reasons.join(" "), /employment, education, or project/);
});

test("dashboard display and server-side authorization boundaries remain explicit", () => {
  const panel = read("src/features/document-generation/indicative-ats-panel.tsx");
  assert.match(panel, /Indicative ATS Score/);
  assert.match(panel, /Target: \{result\.benchmark\}/);
  assert.match(panel, /not a third-party ATS guarantee/);
  assert.match(panel, /result\.score/);
  assert.match(panel, /result\.breakdown/);
  assert.match(read("src/features/client-portal/client-dashboard-page.tsx"), /IndicativeAtsPanel/);
  assert.match(read("src/app/client/ats/page.tsx"), /getCurrentClientAtsScore/);
  assert.match(read("src/app/client/ats/page.tsx"), /IndicativeAtsPanel/);
  assert.match(read("src/app/admin/clients/[userId]/global-ats/page.tsx"), /IndicativeAtsPanel/);
  const service = read("src/features/client-portal/client-ats-score-service.ts");
  assert.match(service, /resolveLinkedClientProfile\(\)/);
  assert.doesNotMatch(service, /browser|formData|searchParams|candidateId/);
  assert.match(read("src/features/client-portal/contact-profile-service.ts"), /requireApplicationRole\("client"\)/);
  assert.match(read("src/features/document-generation/admin-global-ats-service.ts"), /requireApplicationRole\("admin"\)/);
  assert.match(read("src/app/client/layout.tsx"), /requireApplicationRole\("client"\)/);
  assert.match(read("src/app/admin/layout.tsx"), /requireApplicationRole\("admin"\)/);
});
