import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "next/cache") return { url: moduleUrl("export function revalidatePath(path){globalThis.__regionalAction.paths.push(path)}"), shortCircuit: true };
  if (specifier === "next/server") return { url: moduleUrl("export function after(fn){globalThis.__regionalAction.after.push(fn)}"), shortCircuit: true };
  if (specifier === "@/features/document-generation/document-regeneration-service") return {
    url: moduleUrl("export async function processDocumentRegenerationJobs(){return {completed:0,failed:0}}"), shortCircuit: true };
  if (specifier === "@/features/authentication/authorization") return {
    url: moduleUrl("export async function requireApplicationRole(role){globalThis.__regionalAction.roles.push(role);if(globalThis.__regionalAction.denied)throw Error('denied');return {userId:'test-client'}}"), shortCircuit: true };
  if (specifier === "./contact-profile-service" && context.parentURL?.endsWith("save-regional-intake-action.ts")) return {
    url: moduleUrl("export async function resolveLinkedClientProfile(){return {profileId:'test-profile'}}"), shortCircuit: true };
  if (specifier === "./regional-intake-service" && context.parentURL?.endsWith("save-regional-intake-action.ts")) return {
    url: moduleUrl("export async function saveCurrentClientRegionalIntake(value,revision){globalThis.__regionalAction.saved.push({value,revision});return globalThis.__regionalAction.result}"), shortCircuit: true };
  if (specifier.startsWith("@/types/")) return nextResolve(new URL(`../src/types/${specifier.slice(8)}.ts`, import.meta.url).href, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const { saveRegionalIntakeAction } = await import("../src/features/client-portal/save-regional-intake-action.ts");
const previous = { status: "idle", message: "" };
function setup() {
  globalThis.__regionalAction = { denied: false, result: "saved", roles: [], paths: [], saved: [], after: [] };
  const form = new FormData();
  form.set("regionalData", JSON.stringify({ version: 1, global: { market: "canada" } }));
  form.set("revision", "4");
  return form;
}
test("regional action requires client role before any write", async () => {
  const form = setup(); globalThis.__regionalAction.denied = true;
  await assert.rejects(saveRegionalIntakeAction(previous, form), /denied/);
  assert.deepEqual(globalThis.__regionalAction.saved, []);
});
test("regional action rejects injected fields and malformed revision", async () => {
  const form = setup(); form.set("selectedPackage", "executive-transition-agency-distribution");
  assert.equal((await saveRegionalIntakeAction(previous, form)).status, "error");
  const other = setup(); other.set("revision", "NaN");
  assert.equal((await saveRegionalIntakeAction(previous, other)).status, "error");
  assert.deepEqual(globalThis.__regionalAction.saved, []);
});
test("regional action queues only a successful revision-checked save", async () => {
  const form = setup();
  assert.equal((await saveRegionalIntakeAction(previous, form)).status, "success");
  assert.deepEqual(globalThis.__regionalAction.saved, [{ value: { version: 1, global: { market: "canada" } }, revision: 4 }]);
  assert.deepEqual(globalThis.__regionalAction.paths, ["/client", "/admin"]);
  assert.equal(globalThis.__regionalAction.after.length, 1);
  const stale = setup(); globalThis.__regionalAction.result = "stale";
  assert.equal((await saveRegionalIntakeAction(previous, stale)).status, "stale");
  assert.equal(globalThis.__regionalAction.after.length, 0);
});
