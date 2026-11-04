import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(projectRoot, "supabase", "migrations");
const md5 = (text) => createHash("md5").update(text).digest("hex");
const versionPattern = /^(\d{14})_(.+)\.sql$/;

export function readLocalMigrations(directory = migrationsDir) {
  return readdirSync(directory).filter((file) => file.endsWith(".sql")).sort().map((file) => {
    const match = versionPattern.exec(file);
    if (!match) throw new Error(`Invalid migration filename: ${file}`);
    // Git normalizes repository text to LF, but Windows worktrees may contain
    // CRLF. Migration equivalence is based on SQL content, not checkout EOLs.
    const body = readFileSync(join(directory, file), "utf8").replace(/\r\n/g, "\n");
    return {
      version: match[1], name: match[2],
      // Supabase's recorded SQL sometimes omits the source file's final EOL.
      bodyMd5: md5(body), bodyWithoutFinalEolMd5: md5(body.replace(/(?:\r?\n)+$/, "")),
    };
  });
}

export function compareMigrationHistory(localRows, remoteRows) {
  const findings = [];
  if (!Array.isArray(localRows) || !Array.isArray(remoteRows)) {
    return { ok: false, findings: ["Both local and remote migration lists are required."], matches: [] };
  }
  const checkUnique = (rows, label) => {
    const versions = new Set();
    const names = new Set();
    for (const row of rows) {
      if (!row || !/^\d{14}$/.test(row.version) || typeof row.name !== "string" ||
          !row.name || versions.has(row.version) || names.has(row.name)) {
        findings.push(`${label} history has an invalid or duplicate version/name.`);
        continue;
      }
      versions.add(row.version);
      names.add(row.name);
    }
  };
  checkUnique(localRows, "Local");
  checkUnique(remoteRows, "Remote");
  const local = [...localRows].sort((a, b) => a.version.localeCompare(b.version));
  const remote = [...remoteRows].sort((a, b) => a.version.localeCompare(b.version));
  if (local.length !== remote.length) findings.push(`Migration count differs: local ${local.length}, remote ${remote.length}.`);
  const matches = [];
  for (let i = 0; i < Math.max(local.length, remote.length); i += 1) {
    const left = local[i];
    const right = remote[i];
    if (!left || !right) continue;
    if (left.name !== right.name) {
      findings.push(`Migration order/name differs at position ${i + 1}: local ${left.name}, remote ${right.name}.`);
      continue;
    }
    if (!/^[0-9a-f]{32}$/.test(right.body_md5 ?? "")) {
      findings.push(`${left.name}: remote SQL checksum is missing or invalid; equivalence cannot be assumed.`);
      continue;
    }
    const sameBody = right.body_md5 === left.bodyMd5 || right.body_md5 === left.bodyWithoutFinalEolMd5;
    if (!sameBody) {
      findings.push(`${left.name}: SQL checksum differs; do not replay or repair history without DBA review.`);
      continue;
    }
    matches.push({ name: left.name, localVersion: left.version, remoteVersion: right.version,
      status: left.version === right.version ? "exact" : "equivalent-sql-version-alias" });
  }
  return { ok: findings.length === 0, findings, matches };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3) {
    process.stderr.write("Usage: node scripts/check-migration-reconciliation.mjs <read-only-remote-history.json>\n");
    process.exitCode = 1;
  } else {
    try {
      const parsed = JSON.parse(readFileSync(resolve(input), "utf8"));
      const result = compareMigrationHistory(readLocalMigrations(), parsed.migrations ?? parsed);
      for (const row of result.matches) {
        process.stdout.write(`${row.name}: ${row.status} (${row.localVersion} -> ${row.remoteVersion})\n`);
      }
      for (const finding of result.findings) process.stderr.write(`${finding}\n`);
      if (!result.ok) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`Migration comparison could not complete: ${error instanceof Error ? error.message : "unknown error"}\n`);
      process.exitCode = 1;
    }
  }
}
