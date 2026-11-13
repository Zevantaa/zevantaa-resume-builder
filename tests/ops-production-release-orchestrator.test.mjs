import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
const release = readFileSync(join(root, "scripts", "Invoke-ZevantaaProductionRelease.ps1"), "utf8");
const backup = readFileSync(join(root, "scripts", "backup-private-storage.mjs"), "utf8");
const restore = readFileSync(join(root, "scripts", "verify-encrypted-backup-restore.mjs"), "utf8");
const databaseStream = readFileSync(join(root, "scripts", "stream-encrypted-database-dump.mjs"), "utf8");
const snapshot = readFileSync(join(root, "docs", "sql", "ZEVANTAA_RELEASE_SNAPSHOT_READ_ONLY.sql"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("production release entry point is dry-run by default and pinned to Zevantaa targets", () => {
  assert.match(release, /\[string\]\$Mode = "DryRun"/);
  assert.match(release, /ValidateSet\("DryRun", "Prepare", "Release"\)/);
  assert.match(release, /feature\/client-experience-admin-ats-enhancement/);
  assert.match(release, /https:\/\/github\.com\/Zevantaa\/zevantaa-resume-builder\.git/);
  assert.match(release, /https:\/\/ats\.zevantaacareers\.com/);
  assert.match(release, /fzltowzpfrnuxxxrzuih/);
  assert.match(release, /zevantaa-careers-pvt-ltd/);
  assert.match(release, /supabase@3\.1\.0/);
  assert.match(release, /vercel@65\.14\.0/);
  assert.equal(packageJson.scripts["release:production"].includes("Invoke-ZevantaaProductionRelease.ps1"), true);
});

test("release refuses unsafe repository, evidence, and authorization states", () => {
  assert.match(release, /Working tree is not clean/);
  assert.match(release, /HEAD does not match the operator-approved immutable commit/);
  assert.match(release, /outside the Git repository/);
  assert.match(release, /evidence directory must be new and empty/);
  assert.match(release, /allowSchemaMigration/);
  assert.match(release, /allowDeployment/);
  assert.match(release, /allowMigrationRepair/);
  assert.doesNotMatch(release, /git\s+merge|git\s+push\s+--force|--force-with-lease/i);
  assert.doesNotMatch(release, /db",\s*"reset",\s*"--remote/);
});

test("local and provider gates cover the complete requested release validation", () => {
  for (const required of [
    "Release toolchain", "Full regression suite", "ESLint", "TypeScript", "Production build", "Secret scan",
    "Production dependency audit", "GitHub authorization", "Supabase authorization",
    "Vercel authorization and project link", "Auth and SMTP attestation",
    "Vercel production environment", "Read-only production smoke tests",
    "Automation worker and scheduler preflight",
  ]) assert.match(release, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(release, /backup-private-storage\.mjs/);
  assert.match(release, /"--scope", \$VercelTeamSlug, "env", "pull"/);
  assert.match(release, /"projects", "api-keys", "--reveal"/);
  assert.match(release, /\$env:SUPABASE_SECRET_KEY = \[string\]\$secretKeys\[0\]\.api_key/);
  assert.doesNotMatch(release, /env", "list"[^\n]*"--json"/);
});

test("backup streams official dump plans and private Storage bytes into age outside Git", () => {
  for (const fragment of [
    '"--role-only"', '"--data-only"', '"--use-copy"', '"supabase_migrations"', '"--dry-run"',
    '"checksums.sha256"', "Test-IsolatedRestore", "Get-AgeKeyMaterial", "CryptProtectData", "CryptUnprotectData",
  ]) assert.equal(release.includes(fragment), true, fragment);
  for (const bucket of [
    "candidate-intake-private", "candidate-documents-private", "zevantaa-brand-assets",
  ]) {
    assert.equal(backup.includes(bucket), true);
    assert.equal(restore.includes(bucket), true);
  }
  assert.match(backup, /createHash\("sha256"\)/);
  assert.match(backup, /\.age/);
  assert.match(backup, /bytes\.fill\(0\)/);
  assert.doesNotMatch(backup, /writeFile\([^)]*bytes/);
  assert.match(databaseStream, /docker[\s\S]*bash[\s\S]*age/);
  assert.match(databaseStream, /"--read-only"/);
  assert.match(databaseStream, /\/tmp:rw,noexec,nosuid,size=64m/);
  assert.doesNotMatch(release, /"--file", \(Join-Path \$backupRoot/);
  assert.doesNotMatch(release, /Get-Command psql/);
  assert.match(release, /--tmpfs/);
  assert.match(release, /\/var\/lib\/postgresql\/data:rw,nosuid,size=4g/);
  assert.match(release, /\/restore:rw,noexec,nosuid,size=2g/);
  assert.match(release, /"--network", "none"/);
  assert.match(backup, /projectRefFromUrl\(url\) !== PRODUCTION_REF/);
  assert.match(restore, /--confirm-memory-only-target/);
  assert.match(restore, /plaintextPersistentWrites: 0/);
  assert.match(restore, /restored private Storage object failed byte-for-byte verification/i);
  assert.match(snapshot, /private_storage_objects/);
  assert.doesNotMatch(release, /source-counts\.json["']/);
  assert.match(release, /source-counts\.json\.age/);
});

test("migration comparison, repair, and push are fail-closed and ordered", () => {
  assert.match(release, /\$ForwardMigrations = @\([\s\S]*20261111085249[\s\S]*20261113052443/);
  assert.match(release, /\$ForwardMigrations \| Where-Object \{ \$migrationName -like "\$_\*" \}/);
  assert.match(release, /"db", "diff"/);
  assert.match(release, /"--strict-coverage"/);
  assert.match(release, /"--from", \$SupabaseProjectRef, "--to", "migrations"/);
  assert.match(release, /Bidirectional public-schema comparison found a material difference/);
  assert.match(release, /differences outside bidirectionally identical function canonicalization/);
  assert.match(release, /function-canonicalization\.json/);
  assert.match(release, /"migration", "repair", "--status", "applied"/);
  assert.match(release, /"db", "push", "--dry-run", "--skip-vault"/);
  assert.match(release, /Forward migrations dry-run/);
  assert.match(release, /No migration history, schema, deployment, secret, or scheduler state was changed/);
  assert.match(release, /\$mentioned\.Count -ne \$pending\.Count/);
  assert.match(release, /did not preserve the approved forward-migration order/);
  assert.match(release, /20261111085249/);
  assert.match(release, /20261113052443/);
  assert.match(release, /post-migration-counts\.json/);
  assert.match(release, /source-counts\.json/);
  assert.match(release, /preservation counts/);
  assert.match(release, /Assert-ReleaseCanContinue "isolated restore"[\s\S]*Test-AutomationMigrationEquivalence/);
  assert.match(release, /ZEVANTAA_RELEASE_SECURITY_READ_ONLY\.sql/);
  assert.match(release, /privateBucketsVerified/);
  assert.match(release, /crossClientRlsDenied/);
  assert.match(release, /workerSecretsIndependentlyVerified/);
  assert.match(release, /required_vault_names_present/);
});

test("Cron is never activated and reports remain credential-free", () => {
  assert.doesNotMatch(release, /configure_zevantaa_automation_schedule/);
  assert.match(release, /cronActivated = \$false/);
  assert.match(release, /Cron was not activated/);
  assert.match(release, /release-report\.json/);
  assert.match(release, /release-report\.md/);
  assert.doesNotMatch(release, /Write-Host\s+\$projects|Write-Host\s+\$status|Write-Host\s+\$names/);
});

test("encrypted restore helper refuses execution without memory-only confirmation", () => {
  const result = spawnSync(process.execPath, [join(root, "scripts", "verify-encrypted-backup-restore.mjs")], {
    cwd: root,
    env: { ...process.env },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Explicit memory-only restore confirmation is required/);
});
