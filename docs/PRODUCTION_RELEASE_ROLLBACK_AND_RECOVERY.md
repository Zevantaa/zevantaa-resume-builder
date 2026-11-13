# Production release rollback and recovery

## Stop conditions

Stop immediately on any failed backup checksum, restore mismatch, nonempty
automation schema diff, unexpected migration in `db push --dry-run`, changed Auth
or role counts, private Storage/RLS failure, wrong Vercel project, failed security
header, unauthorized worker response, or unexpected scheduler state. Do not
continue by overriding the report.

## Before schema change

No rollback is required because the orchestrator has made no production change.
Keep the failed evidence directory restricted, correct access/tooling or prepare a
reviewed forward reconciliation migration, and start a new release run. Never
replay the six automation migrations and never mark history applied merely to make
the CLI green.

## After migration repair, before schema migration

Official migration repair changes only `supabase_migrations.schema_migrations`.
If the repaired history is later found incorrect, stop and obtain database-owner
review. Use official `migration repair --status reverted` only with explicit
approval and evidence of the actual schema state. Do not alter the table manually.

## After forward migrations, before deployment

Keep the additive `client_onboarding_invitations` table in place. It begins empty,
does not backfill or modify Auth users, roles, profiles, files, or documents, and is
backward-compatible with the previous application. Also keep the additive client
lifecycle and document-ATS tables, columns, triggers, and functions. The document
ATS migration queues assessments for eligible existing source and generated resume
files, but does not change those files, document versions, Auth users, profiles, or
role assignments. Do not drop these objects or delete queued evidence as a
rollback. If postflight counts, grants, triggers, or queue constraints are wrong,
stop and prepare a forward-only repair or restore first into isolation from the
verified backup.

## After deployment

1. Keep Cron disabled.
2. Record UTC time, failed check, deployment ID, commit, and sanitized request IDs.
3. Redeploy the last known-good immutable commit to the same existing Vercel
   project. Do not rotate a healthy secret or restore an old compromised value.
4. Rerun login, role separation, private download, public-route headers, and worker
   authentication denial.
5. Preserve queues, leases, failed jobs, document history, invitation evidence, and
   Storage objects. Never truncate or delete them to clear an error.

## Database or Storage recovery

Disable new application mutations and scheduler calls first. Restore the verified
backup into a fresh isolated target, compare aggregate counts, constraints, RLS,
policies, migration history, bucket inventories, and every object checksum, then
obtain business-owner approval before any production restoration. A database-only
restore is insufficient because Supabase database backups contain Storage metadata,
not object bytes.

Never run `supabase db reset --remote`, a destructive down migration, or a first-
time restore over production. Document RPO, RTO, affected writes, operator,
reviewer, and acceptance using `assurance/RESTORE_DRILL_TEMPLATE.md`.

## Worker emergency shutdown

With database-owner authorization, call
`select public.disable_zevantaa_automation_schedule();`, verify the named job is no
longer active, and allow current leases to finish or expire. If the worker token is
suspected compromised, rotate the Vercel and Vault copies together without logging
either value. Do not activate Cron again until one authenticated manual invocation,
retry, lease recovery, and duplicate-prevention test pass.
