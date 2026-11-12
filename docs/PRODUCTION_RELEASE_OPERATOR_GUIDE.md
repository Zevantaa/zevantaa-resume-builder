# Simplified secure production release operator guide

## Safety model

The single entry point is `scripts/Invoke-ZevantaaProductionRelease.ps1`. It is
fail-closed, defaults to `DryRun`, pins Supabase CLI `3.1.0` and Vercel CLI
`65.14.0`, writes evidence outside Git, and never activates Cron. It does not
merge, push, force-push, reset a database, delete candidate data, expose secret
values, or replay the six automation migrations.

Supabase CLI v3 targets local infrastructure by default. Every hosted operation in
the orchestrator therefore names `fzltowzpfrnuxxxrzuih` explicitly. The script
uses `db query --read-only` for production SQL evidence, `db diff` against a shadow
built only through the six automation migrations, official `migration repair`
only after equivalence and explicit approval, and `db push --dry-run` before the
single invitation-state migration.

## First command: dry-run

From the repository root in VS Code PowerShell:

```powershell
npm.cmd run release:production -- -Mode DryRun -ExpectedCommit (git rev-parse HEAD) -EvidenceRoot "D:\ZevantaaReleaseEvidence\dry-run-001"
```

Dry-run performs all local quality gates and read-only GitHub, Supabase, and
Vercel authorization checks. It does not create a backup, restore data, repair
history, apply SQL, deploy, change secrets, or activate Cron. Its overall release
verdict remains `FAIL` until those deliberately unexecuted production gates are
completed; that is expected and is not a script malfunction.

During development of the script only, `-AllowDirtyWorkingTree` can be used with
`DryRun`. It is rejected as a release substitute and must never appear in the
authorized production command.

Reports are written as `release-report.json` and `release-report.md` below the
specified evidence root. They contain controlled results only, never raw provider
responses, candidate data, object keys, or credentials.

## What the authorized command does

After every item in `PRODUCTION_RELEASE_ACCESS_CHECKLIST.md` is complete, invoke:

```powershell
npm.cmd run release:production -- `
  -Mode Release `
  -ExpectedCommit "<full-reviewed-sha>" `
  -EvidenceRoot "D:\ZevantaaReleaseEvidence\release-001" `
  -AuthorizationRecord "D:\ZevantaaReleaseEvidence\authorization.json" `
  -AuthConfigurationAttestation "D:\ZevantaaReleaseEvidence\auth-smtp-attestation.json" `
  -VercelProjectId "<existing-zevantaa-project-id>" `
  -AuthorizeMigrationRepair `
  -AuthorizeSchemaMigration `
  -AuthorizeDeployment
```

Omit `-AuthorizeMigrationRepair` when all six versions already exist in remote
history. The signed authorization file must agree with every supplied switch.

The command executes these gates in order and stops at the first critical failure:

1. Exact branch, origin, clean tree, immutable commit, tests, lint, TypeScript,
   build, secret scan, production dependency audit, and whitespace check.
2. Read and dry-run-push authorization to GitHub; read-only database access to the
   named Supabase project; inspection of the existing linked Vercel project/domain.
3. Secret-free Auth/SMTP/private-access/worker attestation, Vercel production
   environment validation using `vercel env run`, and read-only proof that the two
   required Vault secret names exist while Cron remains inactive. Secret values are
   never downloaded or printed.
4. Official Supabase logical dumps for roles, application schema, data, and
   migration history; read-only managed-schema/RLS evidence; download and SHA-256 verification of every object
   in `candidate-intake-private`, `candidate-documents-private`, and
   `zevantaa-brand-assets`.
5. Fresh local Supabase/Docker restore using the PostgreSQL client inside the
   isolated database container, aggregate database-count
   comparison, restore of all private object bytes, and checksum read-back. The
   production database is never a restore target.
6. Shadow-vs-live schema diff using migrations only through
   `20261103223240_ats_assessment_provenance.sql`. Any nonempty diff blocks release.
7. If history is missing and separately authorized, official
   `supabase migration repair --status applied ... --remote=<project>` for only the
   missing, already-proved-equivalent automation versions.
8. `supabase db push --dry-run`; the output must name exactly
   `20261111085249_client_onboarding_invitation_state.sql`. Only then can the
   separately authorized push occur, followed by read-only postflight.
9. Deployment of the reviewed commit to the existing Vercel project, followed by
   public GET/security-header checks and proof that the internal worker rejects an
   unauthenticated request.
10. Read-only scheduler/queue state capture. Cron remains inactive unless a later,
    separate operator action follows the scheduler runbook.

## Evidence handling

Keep the evidence directory encrypted and access-restricted. It includes candidate
database rows and private file bytes even though the generated report contains
only aggregate findings. Do not copy it into this repository, GitHub Actions,
email, chat, or a public/synchronized folder. Record retention and secure deletion
with the Zevantaa data owner.

## PASS and FAIL

`PASS` means every gate included in the selected mode completed. `FAIL` identifies
the exact gate and recovery action. Never edit the report to change a verdict.
Create a new evidence directory and rerun after remediation. A dry-run `FAIL`
caused only by deliberately unopened production gates is the correct pre-release
result.

## Cron activation

This command never calls `configure_zevantaa_automation_schedule()`. After a
successful production release and authenticated end-to-end worker test, follow
`AUTOMATION_SCHEDULER_RUNBOOK.md` with separate secret verification and explicit
authorization. Emergency shutdown remains
`select public.disable_zevantaa_automation_schedule();` by the database owner.

## Official references

- Supabase CLI v3 hosted-target behavior:
  <https://supabase.com/changelog/supabase-cli-v3>
- Supabase migration history and official repair workflow:
  <https://supabase.com/docs/guides/deployment/database-migrations>
- Supabase CLI backup and restore:
  <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- Supabase database-backup scope, including the Storage-byte exclusion:
  <https://supabase.com/docs/guides/platform/backups>
- Vercel CLI deployment workflow:
  <https://vercel.com/docs/projects/deploy-from-cli>
