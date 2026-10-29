import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("public root redirects to login without rendering the foundation preview", () => {
  const root = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(root, /import\s*\{\s*redirect\s*\}\s*from\s*["']next\/navigation["']/);
  assert.match(root, /redirect\(["']\/login["']\)/);
  assert.doesNotMatch(root, /StyleDemo|Placeholder routes|Phase 2 application foundation/);
});

test("login still accepts explicit admin and client portal intent", () => {
  const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /getAuthPortalIntent\(portal\)/);
  assert.match(login, /<LoginExperience portal=/);
});
