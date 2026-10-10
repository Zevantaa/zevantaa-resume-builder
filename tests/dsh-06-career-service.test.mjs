import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
  if (specifier === "@/lib/supabase/admin") return { url: mock("export function createSupabaseAdminClient(){return globalThis.__careerDb.db}"), shortCircuit: true };
  if (specifier === "@/features/document-generation/admin-global-ats-service") return {
    url: mock("export async function loadCandidateProfileById(id){return id===globalThis.__careerDb.profile.id?globalThis.__careerDb.profile:null}"), shortCircuit: true,
  };
  if (specifier === "./contact-profile-service" && context.parentURL?.endsWith("career-profile-service.ts")) return {
    url: mock("export async function resolveLinkedClientProfile(){return globalThis.__careerDb.linked}"), shortCircuit: true,
  };
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith("./") && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { toCareerDraft } = await import("../src/features/client-portal/career-profile-model.ts");
const { validateCareerDraft } = await import("../src/features/client-portal/career-profile-validation.ts");
const { getCurrentClientCareerProfile, saveCurrentClientCareerProfile } = await import("../src/features/client-portal/career-profile-service.ts");
const actor = "99999999-9999-4999-8999-999999999999";

function setup() {
  const state = {
    profile: createLongGlobalAtsQaProfile(),
    revision: 7,
    linked: null,
    calls: [],
    forceStale: false,
  };
  state.linked = { profileId: state.profile.id, userId: actor };
  state.db = {
    from(name) {
      assert.equal(name, "candidate_profiles");
      const query = { select() { return this; }, eq() { return this; }, is() { return this; },
        async maybeSingle() { return { data: { career_revision: state.revision }, error: null }; } };
      return query;
    },
    async rpc(name, args) {
      assert.equal(name, "apply_client_career_profile");
      state.calls.push(args);
      if (state.forceStale) return { data: null, error: null };
      const payload = args.p_payload;
      state.profile.professionalSummary = payload.professionalSummary;
      for (const section of ["workExperience", "education", "skills", "certifications", "languages", "projects"]) {
        state.profile[section] = payload[section].map(({ changed, ...item }) => {
          void changed;
          return item;
        });
      }
      state.profile.additionalSections = payload.additionalSections.map(({ changed, ...section }) => {
        void changed;
        return { ...section, items: section.items.map(({ changed: itemChanged, ...item }) => {
          void itemChanged;
          return item;
        }) };
      });
      state.revision += 1;
      return { data: state.revision, error: null };
    },
  };
  globalThis.__careerDb = state;
  return state;
}

test("linked client edits summary, work and skills; fresh reload contains new facts", async () => {
  const state = setup();
  const originalIdentity = { name: state.profile.fullName, email: state.profile.primaryEmail,
    mobile: state.profile.mobileNumber, package: state.profile.selectedPackage };
  const draft = toCareerDraft(state.profile);
  draft.professionalSummary = "Client-authored fictional operations update.";
  draft.workExperience[0].jobTitle = "Newly updated fictional role";
  draft.workExperience.splice(1, 1);
  draft.workExperience.push({ key: "new-77777777-7777-4777-8777-777777777777", jobTitle: "New fictional role",
    employerName: "Example Company", startDate: "2026-01", endDate: "", currentRole: true,
    location: "", description: "", highlights: "" });
  draft.skills[0].name = "Newly supplied skill";
  draft.skills.splice(1, 1);
  draft.skills.push({ key: "new-88888888-8888-4888-8888-888888888888", name: "New skill", category: "" });
  const result = await saveCurrentClientCareerProfile(validateCareerDraft(draft), 7);
  assert.equal(result, "saved");
  const fresh = await getCurrentClientCareerProfile();
  assert.equal(fresh.revision, 8);
  assert.equal(fresh.profile.professionalSummary, "Client-authored fictional operations update.");
  assert.equal(fresh.profile.workExperience[0].jobTitle, "Newly updated fictional role");
  assert.equal(fresh.profile.workExperience.some((item) => item.jobTitle === "New fictional role"), true);
  assert.equal(fresh.profile.workExperience.some((item) => item.jobTitle.includes("Division 2")), false);
  assert.equal(fresh.profile.skills.some((item) => item.name === "Newly supplied skill"), true);
  assert.equal(fresh.profile.skills.some((item) => item.name === "New skill"), true);
  assert.deepEqual({ name: fresh.profile.fullName, email: fresh.profile.primaryEmail,
    mobile: fresh.profile.mobileNumber, package: fresh.profile.selectedPackage }, originalIdentity);
  const payload = state.calls[0].p_payload;
  assert.equal(payload.workExperience[0].changed, true);
  assert.equal(payload.workExperience[1].changed, true);
  assert.equal(payload.workExperience.at(-1).changed, true);
  assert.equal(payload.education[1].changed, false);
  assert.equal(JSON.stringify(payload).includes("primaryEmail"), false);
  assert.equal(JSON.stringify(payload).includes("selectedPackage"), false);
});

test("education, certifications, languages, projects and additional sections persist via the same RPC", async () => {
  const state = setup();
  const draft = toCareerDraft(state.profile);
  draft.education[0].gradeResult = "Updated fictional CGPA 8.2/10";
  draft.certifications[0].issueYear = "2022";
  draft.languages[0].name = "French";
  draft.languages[0].proficiency = "";
  draft.projects[0].name = "New client-authored fictional project";
  draft.additionalSections[0].items[0].heading = "Updated volunteer work";
  assert.equal(await saveCurrentClientCareerProfile(validateCareerDraft(draft), 7), "saved");
  const fresh = await getCurrentClientCareerProfile();
  assert.equal(fresh.profile.education[0].gradeResult, "Updated fictional CGPA 8.2/10");
  assert.equal(fresh.profile.certifications[0].issueYear, "2022");
  assert.equal(fresh.profile.languages[0].name, "French");
  assert.equal(fresh.profile.languages[0].proficiency, "");
  assert.equal(fresh.profile.projects[0].name, "New client-authored fictional project");
  assert.equal(fresh.profile.additionalSections[0].items[0].heading, "Updated volunteer work");
  assert.equal(state.calls[0].p_payload.additionalSections[0].items[0].changed, true);
});

test("an older form is rejected before writing", async () => {
  const state = setup();
  const draft = validateCareerDraft(toCareerDraft(state.profile));
  assert.equal(await saveCurrentClientCareerProfile(draft, 6), "stale");
  assert.equal(state.calls.length, 0);
  state.forceStale = true;
  assert.equal(await saveCurrentClientCareerProfile(draft, 7), "stale");
  assert.equal(state.calls.length, 1);
});

test("missing or cross-client linkage cannot invoke the privileged RPC", async () => {
  const state = setup();
  const draft = validateCareerDraft(toCareerDraft(state.profile));
  state.linked = null;
  assert.equal(await saveCurrentClientCareerProfile(draft, 7), "missing");
  state.linked = { profileId: "22222222-2222-4222-8222-222222222222", userId: actor };
  assert.equal(await saveCurrentClientCareerProfile(draft, 7), "missing");
  assert.equal(state.calls.length, 0);
});

test("a forged existing-row index cannot be mapped to another candidate row", async () => {
  const state = setup();
  const draft = toCareerDraft(state.profile);
  draft.skills[0].key = "existing-999";
  await assert.rejects(saveCurrentClientCareerProfile(validateCareerDraft(draft), 7), /refresh and try again/i);
  assert.equal(state.calls.length, 0);
});
