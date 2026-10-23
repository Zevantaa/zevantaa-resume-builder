import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const testsRoot = join(projectRoot, "tests");

function discoverTests(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return discoverTests(path);
      return entry.isFile() && entry.name.endsWith(".test.mjs") ? [path] : [];
    });
}

const testFiles = discoverTests(testsRoot);
if (testFiles.length === 0) {
  throw new Error("No *.test.mjs files were found under tests.");
}

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: projectRoot,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
