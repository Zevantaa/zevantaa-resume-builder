import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function executableSql(path) {
  return read(path).replace(/^\s*--.*$/gm, "")
    .replace(/'(?:''|[^'])*'/g, "''");
}

test("preflight and postflight SQL are read-only and target the exact migration set", () => {
  for (const path of [
    "docs/sql/ZEVANTAA_PREDEPLOYMENT_PREFLIGHT_READ_ONLY.sql",
    "docs/sql/ZEVANTAA_POST_MIGRATION_READ_ONLY_CHECKS.sql",
  ]) {
    const sql = executableSql(path);
    assert.doesNotMatch(sql, /\b(?:insert|update|delete|alter|create|drop|truncate|grant|revoke|execute|call)\b/i, path);
  }
  const preflight = read("docs/sql/ZEVANTAA_PREDEPLOYMENT_PREFLIGHT_READ_ONLY.sql");
  for (const version of ["20261103215458", "20261103220738", "20261103221521",
    "20261103222143", "20261103222518", "20261103223240"]) {
    assert.match(preflight, new RegExp(version));
  }
  assert.match(preflight, /fzltowzpfrnuxxxrzuih/);
});

test("activation checklist keeps migration, deployment, scheduling and acceptance manual", () => {
  const checklist = read("docs/PR_1_PREDEPLOYMENT_VALIDATION.md");
  for (const heading of ["Database backup and preservation", "Migration preflight",
    "Safe migration application order", "Database verification", "Vercel configuration",
    "Deployment sequence", "Worker secret and scheduling activation",
    "End-to-end new-client test", "Rollback and emergency shutdown",
    "Final production acceptance"]) assert.match(checklist, new RegExp(heading));
  assert.match(checklist, /status remains \*\*NO-GO\*\*/);
  assert.match(checklist, /not raw-original versus generated PDF/);
});
