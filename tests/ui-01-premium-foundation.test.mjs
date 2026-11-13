import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("server request work is deduplicated without persisting authorization across requests", () => {
  const authorization = read("src/features/authentication/authorization.ts");
  const branding = read("src/features/branding/brand-settings-service.ts");

  assert.match(authorization, /import \{ cache \} from "react"/);
  assert.match(authorization, /export const getAuthContext = cache\(loadAuthContext\)/);
  assert.match(authorization, /supabase\.auth\.getClaims\(\)/);
  assert.match(authorization, /\.from\("user_roles"\)/);
  assert.match(branding, /export const getBrandSettings = cache\(loadBrandSettings\)/);
  assert.doesNotMatch(authorization, /unstable_cache/);
});

test("protected portal navigations have accessible route-level loading feedback", () => {
  const loading = read("src/components/ui/route-loading.tsx");
  const admin = read("src/app/admin/loading.tsx");
  const client = read("src/app/client/loading.tsx");

  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /className="sr-only"/);
  assert.match(admin, /portal="administrator"/);
  assert.match(client, /portal="client"/);
});

test("navigation feedback and motion remain keyboard and reduced-motion safe", () => {
  const shell = read("src/components/dashboard/dashboard-shell.tsx");
  const css = read("src/app/globals.css");

  assert.match(shell, /className="skip-link type-button" href="#main-content"/);
  assert.match(shell, /className="dashboard-route-frame" key=\{pathname\}/);
  assert.match(css, /@keyframes dashboard-route-enter/);
  assert.match(css, /@keyframes route-skeleton-progress/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.dashboard-route-frame[\s\S]*?animation:\s*none/);
  assert.match(css, /\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\)/s);
});
