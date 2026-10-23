import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { releaseVerificationSteps } from "../scripts/release-verify.mjs";

test("release verification runs all local-safe checks and no remote mutation", () => {
  const commands = releaseVerificationSteps.map(([, program, args]) => `${program} ${args.join(" ")}`);
  assert.deepEqual(commands, [
    "node scripts/validate-environment.mjs local",
    "node scripts/check-secrets.mjs",
    "npm test",
    "npm run lint",
    "npm run build",
    "npm audit --omit=dev",
    "git diff --check",
  ]);
  assert.doesNotMatch(commands.join(" "), /deploy|push|merge|apply_migration|db push/i);
  const runner = readFileSync(new URL("../scripts/release-verify.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(runner, /shell:\s*true/);
});
