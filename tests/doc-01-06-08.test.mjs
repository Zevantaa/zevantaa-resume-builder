import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { mapCandidateProfileToDocumentData: map } = await import(
  "../src/features/document-generation/profile-mapper.ts"
);
const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");

function profile(overrides = {}) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    createdAt: "2026-01-10T09:00:00Z",
    updatedAt: "2026-01-10T09:00:00Z",
    fullName: "Aanya Test-Mehta",
    primaryEmail: "aanya.mehta@india.example",
    mobileNumber: "+91-00000-00001",
    currentLocation: "Pune, India",
    relocationPreference: "open",
    selectedPackage: "indian-domestic",
    targetMarkets: ["indian-domestic"],
    professionalSummary: "Fictional operations analyst focused on measurable process improvements.",
    existingResume: { id: "20000000-0000-4000-8000-000000000001" },
    workExperience: [{
      id: "work-2", sortOrder: 2, employerName: "Imaginary Blue Kite Services Ltd",
      jobTitle: "Operations Coordinator", startDate: "2019-06", currentRole: false,
      endDate: "2022-03", description: "Supported fictional scheduling.",
      highlights: ["Maintained a simulated schedule-compliance rate."],
    }, {
      id: "work-1", sortOrder: 1, employerName: "Fictional Meridian Systems Pvt Ltd",
      jobTitle: "Senior Operations Analyst", startDate: "2022-04", currentRole: true,
      highlights: ["Reduced a simulated reporting cycle."],
    }],
    education: [{ id: "edu-2", sortOrder: 2, institutionName: "Example College", qualification: "Bachelor's degree", highlights: [] },
      { id: "edu-1", sortOrder: 1, institutionName: "Fictional Western Institute of Management", qualification: "Master of Business Administration", highlights: [] }],
    skills: [{ id: "skill-2", sortOrder: 2, name: "Reporting" }, { id: "skill-1", sortOrder: 1, name: "Process mapping" }],
    certifications: [{ id: "cert-2", sortOrder: 2, name: "Example Certificate", issuingOrganization: "Example Institute" },
      { id: "cert-1", sortOrder: 1, name: "Fictional Lean Operations Certificate", issuingOrganization: "Example Process Institute", issuedOn: "2024-03" }],
    languages: [], projects: [], additionalSections: [],
    ...overrides,
  };
}

test("summary is the exact candidate-supplied source, not generated prose", () => {
  const source = profile({ professionalSummary: "  Candidate's own wording.  " });
  const mapped = map(source, "resume");
  assert.deepEqual(mapped.data.professionalSummary, {
    text: "  Candidate's own wording.  ", source: "candidate-supplied",
  });
  assert.equal(mapped.data.sourceProfileId, source.id);
  assert.equal(mapped.data.sourceUpdatedAt, source.updatedAt);
  assert.equal(source.professionalSummary, "  Candidate's own wording.  ");
});

test("employment, education, skills, and certifications have stable display order", () => {
  const data = map(profile(), "resume").data;
  for (const [section, first] of [
    ["employment", "work-1"], ["education", "edu-1"],
    ["skills", "skill-1"], ["certifications", "cert-1"],
  ]) assert.equal(data[section][0].id, first);
  assert.equal(data.employment[0].currentRole, true);
  assert.equal("endDate" in data.employment[0], false);
  assert.equal(data.employment[1].endDate, "2022-03");
});

test("empty optional sections, summary, and bullets are omitted without blank headings", () => {
  const data = map(profile({
    professionalSummary: "   ", workExperience: [], education: [], skills: [],
    certifications: [], languages: [], projects: [],
    additionalSections: [{ id: "empty-section", sortOrder: 0, title: "Awards", items: [] }],
  }), "resume").data;
  for (const key of ["professionalSummary", "employment", "education", "skills", "certifications", "languages", "projects", "additionalSections"]) {
    assert.equal(key in data, false, `${key} should be absent`);
  }
  const bullets = map(profile({ workExperience: [{ ...profile().workExperience[0], highlights: ["", "  ", "Real supplied fact"] }] }), "resume").data.employment[0].highlights;
  assert.deepEqual(bullets, ["Real supplied fact"]);
});

test("current role omits conflicting end month with a structured finding", () => {
  const item = { ...profile().workExperience[0], currentRole: true };
  const result = map(profile({ workExperience: [item] }), "resume");
  assert.equal(result.data.employment[0].currentRole, true);
  assert.equal("endDate" in result.data.employment[0], false);
  assert.ok(result.findings.some((finding) => finding.code === "inconsistent_current_role" && finding.severity === "warning"));
});

test("missing optional contact and photo never introduce blank or public fallback values", () => {
  const result = map(profile({
    selectedPackage: "gcc-middle-east", targetMarkets: ["gcc-middle-east"],
    whatsappNumber: " ", linkedinUrl: "", gccPhoto: undefined,
  }), "resume");
  const { data } = result;
  for (const key of ["whatsappNumber", "linkedinUrl"]) assert.equal(key in data.identity, false);
  assert.equal("gccPhotoFileId" in data, false);
  assert.equal(JSON.stringify(data).includes("storage_object_key"), false);
  assert.equal(result.canGenerate, true);
});

test("education result and certification metadata are optional, never invented", () => {
  const { data } = map(profile(), "resume");
  assert.equal("gradeResult" in data.education[0], false);
  assert.equal("expiresOn" in data.certifications[0], false);
  assert.equal("credentialUrl" in data.certifications[0], false);
  assert.equal("issuedOn" in data.certifications[0], true);
});

test("missing required data produces structured errors and blocks output", () => {
  const result = map(profile({ fullName: " ", primaryEmail: "", mobileNumber: "", selectedPackage: "", targetMarkets: [] }), "resume");
  assert.equal(result.canGenerate, false);
  assert.deepEqual(result.findings.filter((f) => f.severity === "error").map((f) => f.code), [
    "missing_full_name", "missing_primary_email", "missing_mobile_number",
    "missing_package", "missing_target_market",
  ]);
  assert.equal("primaryEmail" in result.data.identity, false);
  assert.equal("mobileNumber" in result.data.identity, false);
  assert.ok(result.findings.every((f) => f.code && f.path && f.message));
});

test("purpose-specific missing career context blocks rather than inventing facts", () => {
  const empty = profile({ professionalSummary: undefined, workExperience: [], education: [], skills: [],
    certifications: [], languages: [], projects: [], additionalSections: [] });
  assert.ok(map(empty, "resume").findings.some((f) => f.code === "missing_resume_content" && f.severity === "error"));
  assert.ok(map(empty, "cover-letter").findings.some((f) => f.code === "missing_cover_letter_context" && f.severity === "error"));
  assert.equal(map(profile({ workExperience: [], education: [], skills: [], certifications: [], languages: [], projects: [], additionalSections: [] }), "cover-letter").canGenerate, true);
});

test("incomplete child items are omitted with findings, not rendered as blank labels", () => {
  const result = map(profile({ skills: [{ id: "blank", sortOrder: 0, name: " " }],
    additionalSections: [{ id: "custom", sortOrder: 0, title: "Other", items: [{ id: "item", sortOrder: 0, heading: " " }] }] }), "resume");
  assert.equal("skills" in result.data, false);
  assert.equal("additionalSections" in result.data, false);
  assert.ok(result.findings.filter((f) => f.code === "incomplete_section_item").length >= 2);
});

test("nested custom-section order and supplied text are preserved without fallback facts", () => {
  const source = profile({
    additionalSections: [{ id: "section-b", sortOrder: 2, title: "Volunteering", items: [
      { id: "item-b", sortOrder: 2, heading: "Provided mentoring", highlights: ["Mentored two fictional peers."] },
      { id: "item-a", sortOrder: 1, heading: "Coordinated events", highlights: [] },
    ] }, { id: "section-a", sortOrder: 1, title: "Awards", items: [
      { id: "award", sortOrder: 0, heading: "Fictional award", highlights: [] },
    ] }],
  });
  const { data } = map(source, "resume");
  assert.deepEqual(data.additionalSections.map((section) => section.id), ["section-a", "section-b"]);
  assert.deepEqual(data.additionalSections[1].items.map((item) => item.id), ["item-a", "item-b"]);
  assert.equal(data.additionalSections[1].items[1].highlights[0], "Mentored two fictional peers.");
  assert.equal(data.employment[0].employerName, source.workExperience[1].employerName);
  assert.equal(data.employment[1].description, source.workExperience[0].description);
  assert.equal("description" in data.employment[0], false);
});

test("the three actual fictional seed parent rows map without fabricated values", () => {
  const insert = seed.match(/insert into public\.candidate_profiles \([\s\S]*?on conflict do nothing;/)?.[0];
  assert.ok(insert);
  for (const suffix of ["001", "002", "003"]) {
    const id = `10000000-0000-4000-8000-000000000${suffix}`;
    const start = insert.indexOf(`    '${id}',`);
    assert.ok(start >= 0);
    const end = insert.indexOf("\n  )", start);
    assert.ok(end > start);
    const lines = insert.slice(start, end).split(/\r?\n/).map((line) => line.trim());
    const value = (index) => lines[index]?.match(/'([^']*)'/)?.[1];
    const candidate = profile({
      id: value(0), fullName: value(1), primaryEmail: value(2), mobileNumber: value(3),
      whatsappNumber: value(4), linkedinUrl: value(5), currentLocation: value(6),
      relocationPreference: value(7), selectedPackage: value(8),
      targetMarkets: [value(9)], existingResume: { id: value(10) },
      gccPhoto: value(11) ? { id: value(11) } : undefined,
      professionalSummary: value(12),
      workExperience: [], education: [], skills: [], certifications: [],
      languages: [], projects: [], additionalSections: [],
    });
    const result = map(candidate, "cover-letter");
    assert.equal(result.canGenerate, true);
    assert.equal(result.data.identity.fullName, value(1));
    assert.equal(result.data.professionalSummary.text, value(12));
    assert.deepEqual(result.data.packageContext.targetMarkets, [value(9)]);
    assert.equal("gccPhotoFileId" in result.data, suffix === "002");
  }
});
