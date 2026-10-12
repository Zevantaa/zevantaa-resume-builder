import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "next/cache") return { url: moduleUrl("export function revalidatePath(path){globalThis.__careerAction.paths.push(path)}"), shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: moduleUrl("export async function requireApplicationRole(role){globalThis.__careerAction.roles.push(role);if(globalThis.__careerAction.denied)throw Error('denied')}"), shortCircuit: true,
  };
  if (specifier === "./career-profile-service" && context.parentURL?.endsWith("save-career-profile-action.ts")) return {
    url: moduleUrl("export async function saveCurrentClientCareerProfile(draft,revision){globalThis.__careerAction.saved.push({draft,revision});return globalThis.__careerAction.result}"), shortCircuit: true,
  };
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { createLongGlobalAtsQaProfile } = await import("../src/features/document-generation/global-ats-qa-fixture.ts");
const { toCareerDraft } = await import("../src/features/client-portal/career-profile-model.ts");
const { saveCareerProfileAction } = await import("../src/features/client-portal/save-career-profile-action.ts");

function setup() {
  globalThis.__careerAction = { denied: false, result: "saved", roles: [], paths: [], saved: [] };
  const data = new FormData();
  data.set("careerData", JSON.stringify(toCareerDraft(createLongGlobalAtsQaProfile())));
  data.set("revision", "4");
  return data;
}
const previous = { status: "idle", message: "" };

test("signed-out or wrong-role action cannot reach the save service", async () => {
  const data = setup();
  globalThis.__careerAction.denied = true;
  await assert.rejects(saveCareerProfileAction(previous, data), /denied/);
  assert.deepEqual(globalThis.__careerAction.roles, ["client"]);
  assert.equal(globalThis.__careerAction.saved.length, 0);
});

test("browser-injected admin field is rejected before persistence", async () => {
  const data = setup();
  data.set("packageCode", "gcc-middle-east");
  const result = await saveCareerProfileAction(previous, data);
  assert.equal(result.status, "error");
  assert.equal(globalThis.__careerAction.saved.length, 0);
});

test("valid client career save revalidates dashboard and admin workspace", async () => {
  const data = setup();
  const result = await saveCareerProfileAction(previous, data);
  assert.equal(result.status, "success");
  assert.deepEqual(globalThis.__careerAction.paths, ["/client", "/admin"]);
  assert.equal(globalThis.__careerAction.saved[0].revision, 4);
});

test("stale revision and malformed JSON fail without a success state", async () => {
  let data = setup();
  globalThis.__careerAction.result = "stale";
  assert.equal((await saveCareerProfileAction(previous, data)).status, "stale");
  assert.deepEqual(globalThis.__careerAction.paths, []);
  data = setup();
  data.set("careerData", "{");
  assert.equal((await saveCareerProfileAction(previous, data)).status, "error");
  assert.equal(globalThis.__careerAction.saved.length, 0);
});
