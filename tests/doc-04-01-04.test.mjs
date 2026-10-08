import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: "data:text/javascript,export async function loadAdminCandidateProfile(userId){return globalThis.__atsQaLoad(userId)}",
    shortCircuit: true,
  };
  if (specifier.startsWith("@/features/document-generation/")) {
    const relative = specifier.replace("@/features/document-generation/", "");
    return nextResolve(new URL(`../src/features/document-generation/${relative}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("@/types/")) {
    return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
  }
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { mapCandidateProfileToDocumentData } = await import("../src/features/document-generation/profile-mapper.ts");
const { buildGlobalAtsResumeModel, GlobalAtsResumeNotReadyError } = await import("../src/features/document-generation/global-ats-resume.ts");
const { renderPdfDocument } = await import("../src/features/document-generation/pdf/render-pdf.ts");
const { buildPdfFilename } = await import("../src/features/document-generation/pdf/pdf-filename.ts");
const { POST } = await import("../src/app/admin/clients/[userId]/global-ats/download/route.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const baseProfile = () => ({
  id: id(1), createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z",
  fullName: "Rohan Kapoor", primaryEmail: "rohan@example.invalid", mobileNumber: "+91 90000 00000",
  whatsappNumber: "+91 90000 00001", linkedinUrl: "https://www.linkedin.com/in/fictional-rohan-kapoor/",
  currentLocation: "Chandigarh", relocationPreference: "open", selectedPackage: "indian-domestic",
  targetMarkets: ["indian-domestic"], professionalSummary: "Candidate-supplied operations summary only.",
  workExperience: [], education: [], skills: [], certifications: [], languages: [], projects: [], additionalSections: [],
});
const orderedItem = (number, sortOrder) => ({ id: id(number), sortOrder });

function fullProfile() {
  const profile = baseProfile();
  profile.workExperience = [
    { ...orderedItem(3, 2), jobTitle: "Operations Lead", employerName: "Fictional Retail Group", startDate: "2019-01",
      endDate: "2022-06", currentRole: false, location: "Delhi", description: "Coordinated inventory reporting.",
      highlights: ["Documented a supplied process change."] },
    { ...orderedItem(2, 1), jobTitle: "Operations Manager", employerName: "Horizon Fictional Solutions", startDate: "2022-07",
      currentRole: true, location: "Chandigarh", description: "Managed supplied operations responsibilities.",
      highlights: ["Led candidate-reported planning meetings."] },
  ];
  profile.education = [
    { ...orderedItem(5, 2), qualification: "Bachelor of Commerce", institutionName: "Fictional City College", completionYear: 2015,
      highlights: [] },
    { ...orderedItem(4, 1), qualification: "MBA (Operations)", institutionName: "Fictional University", completionYear: 2017,
      gradeResult: "CGPA 8.1/10", highlights: [] },
  ];
  profile.skills = [
    { ...orderedItem(7, 2), name: "Inventory coordination" },
    { ...orderedItem(6, 1), name: "Process mapping", category: "Operations" },
  ];
  profile.certifications = [
    { ...orderedItem(8, 1), name: "Lean Six Sigma Green Belt", issuingOrganization: "Fictional Training Institute", issueYear: 2021 },
    { ...orderedItem(9, 2), name: "Advanced Excel", issuingOrganization: "Example Academy", issuedOn: "2020-05" },
  ];
  profile.projects = [{ ...orderedItem(10, 1), name: "Warehouse Reporting Pilot", role: "Coordinator",
    startDate: "2021-02", endDate: "2021-09", description: "Candidate-supplied pilot description.",
    highlights: ["Recorded weekly review notes."], technologies: ["Excel"], url: "https://example.invalid/pilot" }];
  profile.languages = [{ ...orderedItem(11, 1), name: "Hindi", proficiency: "fluent" },
    { ...orderedItem(12, 2), name: "English" }];
  profile.additionalSections = [{ ...orderedItem(13, 1), title: "Volunteer Experience", items: [
    { ...orderedItem(14, 1), heading: "Community Logistics Volunteer", description: "Candidate-supplied volunteer work.", highlights: [] },
  ] }];
  return profile;
}

async function inspect(buffer) {
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  assert.ok(buffer.byteLength > 1000);
  const task = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str);
      pages.push({ width: page.view[2], height: page.view[3], items,
        text: items.map((item) => item.str).join(" ") });
    }
  } finally { await task.destroy(); }
  return pages;
}

test("full canonical profile maps into ordered single-column ATS sections without invented content", async () => {
  const profile = fullProfile();
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  assert.equal(mapping.canGenerate, true);
  const model = buildGlobalAtsResumeModel(mapping);
  assert.deepEqual(model.sections.map((section) => section.title ?? "Identity"), [
    "Identity", "Professional Summary", "Professional Experience", "Education", "Skills", "Certifications",
    "Projects", "Languages", "Volunteer Experience",
  ]);
  assert.ok(model.sections.every((section) => section.blocks.every((block) => block.kind !== "columns" && block.kind !== "contact-row")));
  assert.equal(model.header, undefined);
  assert.equal(model.footer, undefined);
  const pages = await inspect(await renderPdfDocument(model));
  const text = pages.map((page) => page.text).join(" ");
  for (const value of ["Rohan Kapoor", "Candidate-supplied operations summary", "Operations Manager", "Horizon Fictional Solutions",
    "MBA (Operations)", "CGPA 8.1/10", "Process mapping", "Lean Six Sigma Green Belt", "Warehouse Reporting Pilot",
    "Hindi", "Volunteer Experience", "rohan@example.invalid", "+91 90000 00000"]) assert.ok(text.includes(value), value);
  assert.ok(text.indexOf("Operations Manager") < text.indexOf("Operations Lead"));
  assert.ok(text.indexOf("MBA (Operations)") < text.indexOf("Bachelor of Commerce"));
  assert.ok(text.indexOf("Professional Experience") < text.indexOf("Education"));
  assert.match(text, /Jul 2022 - Present/);
  assert.match(text, /Issued: 2021/);
  assert.doesNotMatch(text, /Issued: Jan 2021|ATS Score|Zevantaa Resume Builder QA/);
});

test("minimal valid profile omits all empty optional headings and stays text based", async () => {
  const profile = baseProfile();
  profile.professionalSummary = "";
  profile.whatsappNumber = undefined;
  profile.linkedinUrl = undefined;
  profile.skills = [{ ...orderedItem(20, 1), name: "Operations planning" }];
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  assert.equal(mapping.canGenerate, true);
  const model = buildGlobalAtsResumeModel(mapping);
  assert.deepEqual(model.sections.map((section) => section.title ?? "Identity"), ["Identity", "Skills"]);
  const pages = await inspect(await renderPdfDocument(model));
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /Operations planning/);
  assert.doesNotMatch(pages[0].text, /Certifications|Projects|Languages|Professional Summary|Education/);
  assert.doesNotMatch(pages[0].text, /WhatsApp|undefined|linkedin\.com/);
});

test("missing required identity or career content blocks output safely", () => {
  const profile = baseProfile();
  profile.fullName = "";
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  assert.equal(mapping.canGenerate, false);
  assert.throws(() => buildGlobalAtsResumeModel(mapping), GlobalAtsResumeNotReadyError);
  assert.ok(mapping.findings.some((finding) => finding.code === "missing_full_name"));
  assert.ok(mapping.findings.some((finding) => finding.code === "missing_resume_content"));
});

test("partial optional details preserve exact supplied dates without placeholders", () => {
  const profile = baseProfile();
  profile.education = [{ ...orderedItem(21, 1), qualification: "BA", institutionName: "Fictional College", completionYear: 2019,
    highlights: [] }];
  profile.certifications = [{ ...orderedItem(22, 1), name: "Safety Certificate", issuingOrganization: "Example Institute" }];
  const model = buildGlobalAtsResumeModel(mapCandidateProfileToDocumentData(profile, "resume"));
  const education = model.sections.find((section) => section.title === "Education");
  const certifications = model.sections.find((section) => section.title === "Certifications");
  assert.ok(education.blocks.some((block) => block.kind === "paragraph" && block.text === "2019"));
  assert.ok(certifications.blocks.every((block) => block.kind !== "paragraph"));
  assert.ok(!JSON.stringify(model).includes("Jan 2019"));
});

test("long names, employers, roles, bullets, URL and Unicode remain selectable and within page bounds", async () => {
  const profile = baseProfile();
  profile.fullName = "Rohan Kapoor भारत " + "Fictional Candidate ".repeat(6);
  profile.workExperience = [{ ...orderedItem(23, 1), jobTitle: "Senior Operations and Supply Chain Coordination Manager ".repeat(3),
    employerName: "Fictional International Distribution Cooperative ".repeat(4), startDate: "2020-01",
    endDate: "2025-12", currentRole: false, highlights: ["Candidate-supplied long responsibility. ".repeat(30)],
    description: "Candidate-supplied role description." }];
  profile.linkedinUrl = "https://example.invalid/profiles/" + "long-segment/".repeat(10);
  const model = buildGlobalAtsResumeModel(mapCandidateProfileToDocumentData(profile, "resume"));
  const pages = await inspect(await renderPdfDocument(model));
  const text = pages.map((page) => page.text).join(" ");
  assert.match(text, /Fictional International Distribution/);
  assert.match(text, /Candidate-supplied long responsibility/);
  assert.match(text, /भारत/);
  for (const page of pages) for (const item of page.items) {
    assert.ok(item.transform[4] >= 15 && item.transform[4] + item.width <= page.width - 15);
    assert.ok(item.transform[5] >= 15 && item.transform[5] <= page.height - 15);
  }
});

test("Global ATS filename is safe and does not expose profile IDs", () => {
  const name = buildPdfFilename({ candidateName: "Rohan Kapoor", output: "global-ats-resume" });
  assert.equal(name, "Rohan_Kapoor_Global_ATS_Resume.pdf");
  assert.doesNotMatch(name, /00000000-/);
});

test("admin POST reloads canonical profile, rejects missing/incomplete profiles and ignores posted document data", async () => {
  const url = "http://localhost:3000/admin/clients/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/global-ats/download";
  const request = (body = new URLSearchParams()) => new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" }, body });
  globalThis.__atsQaLoad = async () => { throw new Error("ADMIN_ONLY"); };
  await assert.rejects(() => POST(request(), { params: Promise.resolve({ userId: id(30) }) }), /ADMIN_ONLY/);
  globalThis.__atsQaLoad = async () => null;
  assert.equal((await POST(request(), { params: Promise.resolve({ userId: id(30) }) })).status, 404);
  const incomplete = baseProfile();
  globalThis.__atsQaLoad = async () => incomplete;
  assert.equal((await POST(request(), { params: Promise.resolve({ userId: id(30) }) })).status, 422);
  const nonEntitled = { ...fullProfile(), selectedPackage: "not-a-package" };
  globalThis.__atsQaLoad = async () => nonEntitled;
  assert.equal((await POST(request(new URLSearchParams({ selectedPackage: "indian-domestic" })),
    { params: Promise.resolve({ userId: id(30) }) })).status, 422);
  const complete = fullProfile();
  globalThis.__atsQaLoad = async (userId) => { assert.equal(userId, id(30)); return complete; };
  const response = await POST(request(new URLSearchParams({ fullName: "Tampered Name", employer: "Tampered Employer" })),
    { params: Promise.resolve({ userId: id(30) }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition"), /Rohan_Kapoor_Global_ATS_Resume\.pdf/);
  assert.doesNotMatch(response.headers.get("content-disposition"), /Tampered|00000000-/);
  const pages = await inspect(Buffer.from(await response.arrayBuffer()));
  const text = pages.map((page) => page.text).join(" ");
  assert.match(text, /Rohan Kapoor/);
  assert.doesNotMatch(text, /Tampered Name|Tampered Employer/);
});

test("admin loader and route remain server-only, linked, and absent from client navigation", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const loader = read("src/features/document-generation/admin-global-ats-service.ts");
  assert.match(loader, /import "server-only"/);
  assert.match(loader, /requireApplicationRole\("admin"\)/);
  assert.match(loader, /\.eq\("role_code", "client"\)/);
  assert.match(loader, /\.is\("archived_at", null\)/);
  assert.doesNotMatch(read("src/app/client/layout.tsx"), /global-ats/);
  const route = read("src/app/admin/clients/[userId]/global-ats/download/route.ts");
  assert.match(route, /loadAdminCandidateProfile\(userId\)/);
  assert.match(route, /renderPdfDownloadResponse/);
  assert.doesNotMatch(route, /request\.formData|SUPABASE_SECRET_KEY|service_role/);
});
