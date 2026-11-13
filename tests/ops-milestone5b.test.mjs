import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });

const { areQaUtilitiesEnabled, qaNotFoundResponse } = await import("../src/lib/qa-utilities.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("QA utilities require explicit local or preview opt-in and can never be enabled in production", async () => {
  assert.equal(areQaUtilitiesEnabled({ DEPLOYMENT_ENV: "local", ENABLE_QA_UTILITIES: "true" }), true);
  assert.equal(areQaUtilitiesEnabled({ DEPLOYMENT_ENV: "preview", ENABLE_QA_UTILITIES: "true" }), true);
  assert.equal(areQaUtilitiesEnabled({ DEPLOYMENT_ENV: "preview", ENABLE_QA_UTILITIES: "false" }), false);
  assert.equal(areQaUtilitiesEnabled({ DEPLOYMENT_ENV: "production", ENABLE_QA_UTILITIES: "true" }), false);
  assert.equal(areQaUtilitiesEnabled({ VERCEL_ENV: "production", DEPLOYMENT_ENV: "preview", ENABLE_QA_UTILITIES: "true" }), false);
  assert.equal(areQaUtilitiesEnabled({ NODE_ENV: "production", ENABLE_QA_UTILITIES: "true" }), false);
  assert.equal(areQaUtilitiesEnabled({ NODE_ENV: "production", DEPLOYMENT_ENV: "preview", ENABLE_QA_UTILITIES: "true" }), true);
  const response = qaNotFoundResponse();
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("every browser and server entry point for QA utilities is fail-closed", () => {
  for (const path of [
    "src/app/admin/pdf-render-test/page.tsx",
    "src/app/admin/pdf-render-test/download/route.ts",
    "src/app/client/extraction-test/page.tsx",
    "src/features/document-generation/extract-resume-for-qa-action.ts",
    "src/features/document-generation/pdf/generate-pdf-for-qa-action.ts",
  ]) {
    assert.match(read(path), /QaUtilitiesEnabled/iu, path);
  }
  assert.match(read("src/app/admin/pdf-render-test/download/route.ts"), /qaNotFoundResponse/iu);
  assert.match(read("scripts/validate-environment.mjs"), /Production cannot enable QA utilities/iu);
  assert.doesNotMatch(read(".env.example"), /NEXT_PUBLIC_ENABLE_QA/iu);
});

test("mobile navigation traps and restores focus while hidden controls become inert", () => {
  const shell = read("src/components/dashboard/dashboard-shell.tsx");
  for (const required of ["menuToggleRef", "sidebarRef", "safeOpener.focus()", 'event.key === "Escape"',
    'event.key !== "Tab"', "document.body.style.overflow", "aria-hidden", "inert="]) {
    assert.ok(shell.includes(required), required);
  }
  assert.match(shell, /ArrowUpIcon/iu);
  assert.doesNotMatch(shell, />\s*↑\s*</u);
});

test("route failures recover without rendering exception details", () => {
  for (const path of ["src/app/error.tsx", "src/app/admin/error.tsx", "src/app/client/error.tsx"]) {
    assert.match(read(path), /RouteError/iu, path);
  }
  const boundary = read("src/components/ui/route-error.tsx");
  assert.match(boundary, /onClick=\{reset\}/u);
  assert.match(boundary, /Your data was not changed/u);
  assert.doesNotMatch(boundary, /error\.(?:message|stack|digest)/u);
});

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test("application source contains no known UTF-8 mojibake sequences", () => {
  const offenders = files("src").filter((path) => /\.(?:ts|tsx|css)$/u.test(path))
    .filter((path) => /(?:Â|â€|â†|ï¿½|�)/u.test(readFileSync(path, "utf8")));
  assert.deepEqual(offenders, []);
});

test("fresh setup email flow preserves server authorization and controlled messages", () => {
  const service = read("src/features/admin-portal/client-account-service.ts");
  assert.match(service, /requireApplicationRole\("admin"\)/u);
  assert.match(service, /email_confirmed_at[\s\S]*resetPasswordForEmail/u);
  assert.match(service, /delivery_status", "pending"/u);
  assert.match(service, /eq\("auth_user_id", invitation\.auth_user_id\)/u);
  const action = read("src/features/admin-portal/retry-client-invitation-action.ts");
  assert.doesNotMatch(action, /error\.(?:message|stack)|authUser|token|password/iu);
});
