# PR #1 pre-deployment validation and production activation checklist

Target: Zevantaa Supabase project `fzltowzpfrnuxxxrzuih` and the Zevantaa Vercel project only. This document does not authorize a migration, secret change, deployment, scheduler activation or merge.

## Validation status

Verified in repository and CI:

- The six migrations are ordered after the existing fifteen and use dependencies created by those migrations.
- Changes are additive except for service-only function replacement and the intentional claim-function replacement. There is no migration-time candidate/file/document deletion or archival.
- Existing reviews receive `review_mode = 'admin-confirmed'`; existing files receive a nullable content hash; existing candidate files and generated document rows remain intact.
- New tables have RLS enabled and no `anon` or `authenticated` grants. Queue and ATS mutation RPCs remain service-role-only; scheduler controls remain database-owner-only.
- Supabase Cron supports minute schedules. Supabase recommends no more than eight concurrent jobs and no job longer than ten minutes. `pg_net` is asynchronous and stores responses for six hours by default.
- The worker is a dynamic Node.js route with `maxDuration = 300`, constant-time bearer validation, one source claim and one document claim per invocation.
- Queue uniqueness, `FOR UPDATE SKIP LOCKED`, revision checks, package checks, atomic publication and expiring leases prevent duplicate/stale publication.

Requires manual action/evidence:

- Run the read-only preflight SQL and retain its result.
- Confirm the actual Vercel plan, Fluid Compute setting, production project/domain and function-region configuration in the Vercel dashboard.
- Confirm the Supabase extension versions, migration history aliases, backup entitlement and Storage backup method.
- Apply and live-test only in an approved change window.

Blocked until evidence is supplied:

- Direct Supabase inspection is unavailable to the current connection (`permission denied`).
- The actual Vercel plan and Fluid Compute setting are not represented in the repository, local environment or an accessible dashboard session.
- No database-plus-private-Storage backup/restore evidence or live migration evidence exists.

## Migration order and compatibility

1. `20261103215458_automated_source_processing.sql`: adds nullable `file_records.content_sha256`, the source status enum, private queue, trigger and lease RPCs. Existing files are preserved. Legacy source files remain unhashed and are not silently processed until replaced/re-uploaded.
2. `20261103220738_automated_resume_acceptance.sql`: adds review provenance mode and service-only automatic acceptance. Existing reviews become `admin-confirmed`. The column-scoped UPDATE grant is required for the automatic/client provenance update.
3. `20261103221521_automated_entitlement_orchestration.sql`: adds the explicit frozen package matrix, review/package triggers and global claim. It replaces the existing `claim_document_regeneration_job(uuid)` signature only after that prerequisite is confirmed.
4. `20261103222143_supabase_automation_scheduler.sql`: enables `pg_cron`, `pg_net` and Vault if absent and creates owner-only controls. It does not create a schedule or store a secret.
5. `20261103222518_client_resume_input_confirmation.sql`: adds client confirmation provenance and service-only confirmation RPCs. Substantive career history is required before output enqueueing.
6. `20261103223240_ats_assessment_provenance.sql`: adds immutable service-only score snapshots and deterministic recording.

Migration risks to stop on: missing/renamed DOC-13 claim function; missing enum labels; unvalidated prerequisite constraints; duplicate proposed migration history; unavailable extensions; trigger-name collisions; unexpected browser grants; invalid source/file ownership; duplicate active client links; duplicate current output rows. Do not repair these inline during the change window without a separately reviewed forward migration.

## Hosting and throughput

The route requests 300 seconds. Current Vercel documentation supports 300 seconds on Hobby only with Fluid Compute; Pro supports at least 800 seconds with Fluid Compute. Older/non-Fluid Hobby projects have a lower limit. Production activation is blocked until the dashboard confirms that 300 seconds is valid for the actual project.

Supabase Cron, rather than Vercel Cron, supplies the minute schedule. Current Vercel Hobby Cron is once daily and Vercel does not retry failed Cron invocations. Supabase Cron invokes `pg_net` asynchronously every minute; the queue is the durable retry boundary.

At the scheduler-only baseline, one eleven-document package needs approximately eleven successful minute invocations after source readiness. Request-time kicks can reduce latency. The theoretical scheduler rate is 60 documents/hour before failures; actual capacity must be measured with long/Unicode/GCC-photo profiles and concurrent clients. One new document claim per minute bounds scheduler-added concurrency. Six-minute source and document leases exceed the five-minute route duration; the HTTP timeout is 290 seconds.

## Production activation checklist

### 1. Database backup and preservation — manual, blocking

- Record project ref, production Git SHA, operator and UTC change window.
- Obtain a provider-confirmed database backup or encrypted logical export, including migration history and Auth dependencies.
- Independently inventory and back up private object bytes plus metadata/checksums for `candidate-intake-private`, `candidate-documents-private` and `zevantaa-brand-assets`.
- Record baseline counts from the preflight SQL. A database backup alone is insufficient.
- Confirm a restore owner and tested recovery destination. Do not continue without recoverable evidence.

### 2. Migration preflight — manual, blocking

- Run `docs/sql/ZEVANTAA_PREDEPLOYMENT_PREFLIGHT_READ_ONLY.sql` in the named project.
- Require all fifteen expected migrations, both DOC-13 alias versions, all prerequisite objects/signatures and all three extensions to be available.
- Require proposed migrations absent, new trigger names absent, integrity counts zero and no unexpected unvalidated constraints.
- Compare enum labels to the frozen seven-package/twelve-output model.

### 3. Safe migration application order — manual approval required

- Pause resume uploads, career edits, package edits and manual generation for the maintenance window.
- Apply the six files exactly in the order above, one migration at a time. Stop on the first error.
- Do not enable the scheduler or add Vault secrets during schema rollout.
- Because the old application does not populate `content_sha256`, do not leave migration 1 active with the old upload path open.

### 4. Database verification — manual

- Run `docs/sql/ZEVANTAA_POST_MIGRATION_READ_ONLY_CHECKS.sql` before deployment traffic or scheduler activation.
- Require six recorded migrations, RLS on both new tables, no browser SELECT, the service-role column UPDATE grant, three enabled triggers, validated constraints and zero duplicate queue groups.
- Confirm candidate/user/file/review/document counts match the saved baseline. New queue/snapshot rows may be zero before traffic.
- Confirm there is no `zevantaa-automation-worker` row before explicit activation.

### 5. Vercel configuration — manual, blocking

- Confirm Zevantaa ownership, plan, Fluid Compute, 300-second Node duration support, region and production domain.
- Configure the documented production variables in the Production environment only. `AUTOMATION_WORKER_SECRET` must be independent, random and at least 32 characters.
- Validate configuration without printing values. Never expose server keys through `NEXT_PUBLIC_*`.

### 6. Deployment sequence — manual approval required

- Keep writes paused after the migrations verify.
- Deploy the exact reviewed PR head to a non-production preview first where available; run smoke tests against approved non-production data.
- Promote the same immutable SHA to Zevantaa production and run `environment:validate -- production` in the target environment.
- Verify login, role isolation, private bucket metadata and unauthorized worker response before reopening client writes.
- Do not merge merely because deployment validation succeeds; merge remains a separate approval.

### 7. Worker secret and scheduling activation — manual approval required

- After the application is healthy, store the matching URL/token in Supabase Vault without logging values.
- Invoke the protected worker once manually from a trusted server context and verify HTTP status plus bounded queue progress.
- Activate `select public.configure_zevantaa_automation_schedule();` only with explicit production authorization.
- Verify `cron.job`, `cron.job_run_details` and `net._http_response`. A successful Cron SQL run does not prove the asynchronous HTTP response succeeded.

### 8. End-to-end new-client test — manual

- Create one fictional client through the admin flow and verify no public registration.
- Upload representative DOC, DOCX and text PDF samples separately; confirm unsupported/encrypted/image-only files become targeted `needs-input` rather than invented data.
- Verify automatic acceptance for one unambiguous first profile and targeted correction for one ambiguous profile.
- Verify all entitled outputs enqueue automatically. Executive must publish exactly eight resumes and three cover letters.
- Verify private downloads in a new session, cross-client denial, no public URLs, package upgrade/downgrade behavior, history visibility and version continuity.
- Force one retryable failure and one expired lease; verify recovery without duplicate current documents.
- Verify ATS values are calculated, versioned and candidly described. Current comparison is between canonical career revisions, not raw-original versus generated PDF.

### 9. Rollback and emergency shutdown — manual approval required

- First disable new invocations with `select public.disable_zevantaa_automation_schedule();`; retain run history and queue rows.
- Pause client writes and preserve logs, queue IDs, deployment SHA and minimal error evidence.
- Prefer a reviewed forward repair. Do not drop new tables/columns after they contain provenance or queue state.
- An application-only rollback to the old build is unsafe for resume uploads after migration 1 because the old path does not populate `content_sha256`; keep uploads paused and use a reviewed trigger-disable/forward repair or restore the verified pre-change database plus private Storage snapshot.
- Restore only under incident/release-owner authorization, then rerun all read-only integrity checks.

### 10. Final production acceptance — manual, blocking

- Require signed evidence for backup/restore readiness, migration verification, Vercel plan/runtime, environment validation, Auth/SMTP/security gates, private Storage, scheduler response monitoring, new-client E2E, device QA and human PDF QA.
- Require zero unresolved integrity findings and an owner for max-attempt queue failures and Cron/pg_net history retention.
- Record the final deployed SHA and explicit go/no-go decision. Until every blocking item is closed, status remains **NO-GO**.
