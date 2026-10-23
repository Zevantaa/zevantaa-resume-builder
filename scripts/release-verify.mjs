import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

export const releaseVerificationSteps = [
  ["Local/CI environment", "node", ["scripts/validate-environment.mjs", "local"]],
  ["Secret scan", "node", ["scripts/check-secrets.mjs"]],
  ["Full regression", "npm", ["test"]],
  ["Lint", "npm", ["run", "lint"]],
  ["Production build", "npm", ["run", "build"]],
  ["Production dependency audit", "npm", ["audit", "--omit=dev"]],
  ["Diff whitespace", "git", ["diff", "--check"]],
];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write("REL-01 automated checks only; production environment and provider gates remain manual.\n");
  for (const [label, executable, args] of releaseVerificationSteps) {
    process.stdout.write(`\n${label}\n`);
    if (executable === "npm" && !existsSync(npmCli)) {
      throw new Error("npm CLI was not found; run this command through npm run release:verify.");
    }
    const command = executable === "npm" || executable === "node" ? process.execPath : executable;
    const commandArgs = executable === "npm" ? [npmCli, ...args] : args;
    const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.stderr.write(`${label} failed; later release checks were not run.\n`);
      process.exitCode = result.status ?? 1;
      break;
    }
  }
  if (!process.exitCode) process.stdout.write("\nAutomated checks passed; manual release gates remain OPEN.\n");
}
