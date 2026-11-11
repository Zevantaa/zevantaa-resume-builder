# Milestone 5A production-readiness audit

Audit date: 11 November 2026  
Target repository: `Zevantaa/zevantaa-resume-builder`  
Target branch: `feature/premium-uiux-document-upgrade`  
Audited commit: `4491d56f04418bb76f63372ebb56cb3f4acec872`  
Target Supabase project: `fzltowzpfrnuxxxrzuih`

This is a read-only release audit. No production database statement, migration,
Auth setting, secret, Cron job, Vercel setting, deployment, merge, or production
record was changed. The connected Supabase integration returned “You do not have
permission to perform this action” for read-only project, migration, table, and
advisor requests. Consequently, every live-state item below is explicitly marked
manual or blocked rather than inferred from local source.

## Status and decision

- **VERIFIED** means proved from the audited commit or a completed local command.
- **MANUAL** means a named operator must verify it in the target provider without
  exposing secrets.
- **BLOCKER** means production release must not proceed until the item is closed
  or an accountable release owner records a formal risk acceptance.
- **OPTIONAL** means a useful enhancement that does not change the V1 boundary.

**Current recommendation: NO-GO for production activation.** The branch is clean,
buildable, and locally validated, but live migration equivalence, database backup,
Auth/SMTP configuration, the actual Vercel plan/runtime, private Storage/RLS,
and a production-like end-to-end run are unverified. Expired sent invitations
have no proven resend path, and protected QA-only routes remain compiled into the
production application. No scheduler should be enabled until these gates close.

## 1. Git and release verification

### Verified snapshot

- Branch: `feature/premium-uiux-document-upgrade`.
- HEAD: `4491d56f04418bb76f63372ebb56cb3f4acec872`.
- Working tree was clean before this report was created and remained clean after
  validation commands.
- Remote: `https://github.com/Zevantaa/zevantaa-resume-builder.git`.
- `develop` and `origin/develop`: `902172346edfd4e82810e1c1fd0544a01fbca999`.
- Merge base with `develop`: the same `9021723` commit; this is a linear five-commit
  milestone series rather than an unrelated branch history.

Milestone commits present, in order:

1. `691309f` — `perf: establish premium navigation foundation`
2. `17b4376` — `feat: modernize premium dashboard experience`
3. `498d558` — `feat: upgrade premium document engine`
4. `48ce019` — `fix(pdf): remediate pagination and visual QA`
5. `4491d56` — `feat: harden onboarding and automation operations`

The aggregate diff from `develop` is 70 files, 2,844 insertions and 610 deletions.
It is confined to the approved milestone areas: UI shell/screens, PDF templates and
QA scripts, onboarding and operational visibility, tests, documentation, and one
forward-only onboarding migration. No payment, CRM, public-registration, extra
role, extra document layout, paid AI, or third-party messaging feature was found.
`git diff --check develop...HEAD` passed.

The repository secret scanner passed. A separate diff review found variable names
and safety documentation, but no secret value, credential, private key, bearer
token, or production environment file. `.env*` remains ignored according to the
existing project controls. This is source evidence, not proof of the values held
by GitHub, Vercel, or Supabase.

## 2. Supabase migration preflight

### Local inventory and exact order

There are 22 local forward migrations: 15 established migrations, six automation
migrations already present on `develop`, and one migration added by Milestone 4.
The exact automation/onboarding order is:

1. `supabase/migrations/20261103215458_automated_source_processing.sql`
2. `supabase/migrations/20261103220738_automated_resume_acceptance.sql`
3. `supabase/migrations/20261103221521_automated_entitlement_orchestration.sql`
4. `supabase/migrations/20261103222143_supabase_automation_scheduler.sql`
5. `supabase/migrations/20261103222518_client_resume_input_confirmation.sql`
6. `supabase/migrations/20261103223240_ats_assessment_provenance.sql`
7. `supabase/migrations/20261111085249_client_onboarding_invitation_state.sql`

The six automation files must remain in that order: later files replace or depend
on functions, columns, triggers, tables, and enum values created earlier. They also
depend on the prior 15 migrations, notably `candidate_profiles`, `file_records`,
`profile_resume_reviews`, `document_regeneration_jobs`, persistent document tables,
package values, private Storage metadata, and the document publication RPC.

### Manually executed six-migration risk — BLOCKER

The release owner reports that the six automation migrations were executed in the
SQL Editor but may not be present in `supabase_migrations.schema_migrations`.
The connected account cannot read the target project to confirm either claim.

Do **not** run `supabase db push`, replay the six files, use `migration repair`, or
insert migration-history rows merely to make tooling green. Replaying is unsafe
because the files contain non-idempotent enum/table/function/trigger creation and
function replacement in a deliberate sequence. Fabricating history would hide an
unknown schema body. Before deployment, a database owner must compare the actual
objects and function signatures/bodies with all six reviewed files and record an
approved equivalence manifest outside the database. If they differ, prepare a new
forward-only reconciliation migration; do not edit or rerun an applied file.

Until that equivalence review determines a safe application mechanism, the normal
CLI migration path is blocked. After approval, apply only the genuinely absent
onboarding migration, in a change window, from this exact file:

`supabase/migrations/20261111085249_client_onboarding_invitation_state.sql`

### Onboarding migration review — VERIFIED locally

The migration is a single `begin`/`commit` transaction and creates only
`public.client_onboarding_invitations`. It does not update or delete rows in
`auth.users`, `public.user_roles`, `public.candidate_profiles`, `file_records`,
`document_records`, or any career table.

New columns:

| Column | Rule |
| --- | --- |
| `id` | UUID primary key, generated by `gen_random_uuid()` |
| `candidate_profile_id` | Required FK to `candidate_profiles`; delete restricted |
| `auth_user_id` | Nullable FK to `auth.users`; delete sets null |
| `email` | Required normalized lower-case address, 3–320 characters |
| `account_status` | `active` or `disabled`; defaults to `active` |
| `delivery_status` | `not-sent`, `pending`, `sent`, or `failed` |
| `attempt_count` | Integer from 0 through 20 |
| timestamps | Last attempt, sent, accepted, created, and updated evidence |
| `last_error_code` | Controlled lower-case code, 1–80 characters |
| `created_by_user_id` | Required FK to the creating Auth user; delete restricted |

Unique constraints cover candidate profile, non-null Auth user, and email. A sent
row requires `sent_at`; an accepted row requires both a linked Auth user and
`sent_at`. Indexes cover delivery-state operations and creator lookup. RLS is
enabled; all table access is revoked from `public`, `anon`, and `authenticated`;
only `service_role` receives `select`, `insert`, and `update`, with no delete grant
and no browser policy. No enum, trigger, or existing function is modified.

Prerequisites to verify live are `public.candidate_profiles`, `auth.users`, roles
`anon`/`authenticated`/`service_role`, and `gen_random_uuid()`. Existing users and
role assignments are structurally preserved because the new table starts empty
and has no backfill or trigger on an existing table. Existing administrator and
client accounts will not automatically receive invitation-ledger rows; this is an
operational visibility limitation, not account deletion. Record aggregate counts
before and after migration to prove preservation.

The safe application order is database backup and read-only preflight, six-file
equivalence decision, onboarding migration, database postflight, application
deployment, then Auth/worker validation. Deploying the onboarding code before its
table exists can make client creation and password-acceptance bookkeeping fail.
Leaving the unused additive table in place after an application rollback is safe.
Once it contains evidence, do not drop it as a rollback; restore into isolation or
use a reviewed forward repair.

### Exact read-only SQL for the target project — MANUAL

Run these in the SQL Editor only after visually confirming project reference
`fzltowzpfrnuxxxrzuih`. Export results to the restricted release evidence folder;
do not paste emails, UUIDs, object keys, or SQL bodies into a public ticket.

```sql
-- A. Migration history. This reads history; it does not repair it.
select version, name, md5(array_to_string(statements, '')) as body_md5
from supabase_migrations.schema_migrations
order by version;

-- B. Aggregate preservation baseline; repeat after the migration.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.user_roles) as role_assignments,
  (select count(*) from public.user_roles where role_code = 'admin') as admin_roles,
  (select count(*) from public.candidate_profiles) as candidate_profiles,
  (select count(*) from public.file_records) as file_records,
  (select count(*) from public.document_records) as document_records;

-- C. Required objects from the six manually executed automation migrations.
select object_name, to_regclass(object_name) as relation
from (values
  ('public.resume_processing_jobs'),
  ('public.ats_assessment_snapshots'),
  ('public.document_regeneration_jobs')
) as required(object_name);

select p.oid::regprocedure::text as signature,
       p.prosecdef as security_definer,
       p.proacl as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'enqueue_source_resume_processing',
    'claim_resume_processing_job',
    'complete_resume_processing_job',
    'fail_resume_processing_job',
    'resume_profile_is_empty_for_automatic_import',
    'accept_automated_resume_processing_job',
    'is_v1_output_entitled',
    'enqueue_entitled_document_outputs',
    'reconcile_outputs_after_package_change',
    'claim_document_regeneration_job',
    'invoke_zevantaa_automation_worker',
    'configure_zevantaa_automation_schedule',
    'disable_zevantaa_automation_schedule',
    'confirm_client_resume_processing_input',
    'confirm_client_canonical_resume_input',
    'record_ats_assessment_snapshot'
  )
order by p.oid::regprocedure::text;

select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'candidate_profiles_enqueue_source_processing',
    'profile_resume_reviews_enqueue_outputs',
    'candidate_profiles_reconcile_package_outputs'
  )
order by trigger_name;

-- D. Onboarding preflight. Before application, relation should be null.
select to_regprocedure('pg_catalog.gen_random_uuid()') as uuid_generator,
       to_regclass('public.candidate_profiles') as candidate_profiles,
       to_regclass('auth.users') as auth_users,
       to_regclass('public.client_onboarding_invitations') as onboarding_table;

-- E. Postflight table shape, constraints, indexes, RLS, and grants.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'client_onboarding_invitations'
order by ordinal_position;

select c.conname, c.contype, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.client_onboarding_invitations'::regclass
order by c.conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'client_onboarding_invitations'
order by indexname;

select c.relrowsecurity, c.relforcerowsecurity
from pg_class c
where c.oid = 'public.client_onboarding_invitations'::regclass;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'client_onboarding_invitations'
order by grantee, privilege_type;
```

For true six-file equivalence, a database owner must additionally compare
`pg_get_functiondef(oid)`, enum values, constraints, indexes, triggers, grants,
and RLS to the reviewed local SQL in a restricted session. Function bodies can
contain implementation details and must not be posted publicly. A name-only check
is necessary but not sufficient.

## 3. Authentication and email setup

### Implementation review — VERIFIED locally

The admin-only onboarding service calls Supabase Auth's server-side
`inviteUserByEmail`, records a durable delivery state, links the returned Auth user
to one client role/profile, and never handles a plaintext password. Unique database
constraints and a conditional `failed` to `pending` claim prevent ordinary duplicate
client creation and concurrent retry. `sent` means the provider accepted the send,
not that the recipient inbox received it.

The callback accepts only `invite` or `recovery` exchanges, verifies a PKCE code or
one-time token hash server-side, and redirects to a configured canonical origin.
It never trusts `Host` or forwarded headers. The reset action requires both the
server-verified user and a signed, 15-minute, user-bound, HTTP-only proof cookie;
the proof is consumed and the setup/recovery session is signed out after success.
The production cookie is `Secure`, `SameSite=Lax`, and scoped to `/reset-password`.
No open application redirect or portal-based role grant was found.

### Exact production Auth configuration — MANUAL/BLOCKER

1. Set `NEXT_PUBLIC_APP_URL` to one approved clean HTTPS origin with no path,
   query, fragment, credentials, wildcard, localhost, or preview hostname.
2. Set Supabase Auth **Site URL** to that same origin.
3. Allow only these exact production callback URLs:
   - `https://<approved-host>/auth/callback?portal=client&intent=invite`
   - `https://<approved-host>/auth/callback?portal=client`
   - `https://<approved-host>/auth/callback?portal=admin`
4. Keep Email/Password enabled, public sign-up disabled, and anonymous sign-in
   disabled. Do not enable a new identity provider for this release.
5. Configure a Zevantaa-owned custom SMTP provider with a verified sender/domain.
   Enter host, port, username, password, sender address, and sender name only in
   the Supabase dashboard; never record the secret values in release evidence.
   Verify SPF, DKIM, DMARC, provider rate limits, bounce handling, and that link
   tracking/security scanners do not consume one-time links.
6. Configure **Invite User** with approved Zevantaa wording and this target:

   ```html
   <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=invite">Set up your Zevantaa account</a>
   ```

7. Configure **Reset Password** with approved wording and this target:

   ```html
   <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
   ```

8. Set the password minimum to at least the application's eight-character floor,
   document the selected character policy, enable leaked-password protection when
   available on the owned plan, and enable security notifications for password and
   email changes. Verify that app error copy remains understandable under the
   provider policy.
9. Set and record the invite/recovery OTP expiry window and email rate limits. Test
   newest, expired, invalid, and reused links on a second device.

Supabase's default SMTP is rate-limited and intended for team/testing use; custom
SMTP is required for production delivery. The project cannot honestly claim inbox
delivery from an API success alone.

### Invitation risks

- **BLOCKER — expired sent invitations:** the admin retry path intentionally accepts
  only durable `failed` rows without a linked Auth user. It cannot resend a `sent`
  invitation. A generic password-recovery flow must not be assumed to activate an
  unconfirmed invited user without a live proof. Test this exact provider state; if
  it fails, implement a separately reviewed, idempotent resend/recovery path before
  production onboarding.
- **MANUAL — existing accounts:** they are preserved but not backfilled into the
  new ledger. Document how administrators distinguish legacy accounts from new
  invitation states.
- **MANUAL — token exposure:** the app removes the token hash from the subsequent
  reset URL and does not log it, but proxy/CDN/provider logging and email security
  scanners must be checked operationally.
- **BLOCKER — privileged MFA decision:** app-level master-admin MFA enforcement is
  not implemented. Require MFA on Supabase, Vercel, GitHub, SMTP, and other provider
  accounts; either add and test application-admin MFA in a separately approved
  change or record an accountable release risk decision.

## 4. Production automation readiness

### Worker design — VERIFIED locally

`POST /api/internal/automation` is a force-dynamic Node route with
`maxDuration = 300`. It requires `Authorization: Bearer <secret>`; missing,
shorter-than-32-character, or incorrect secrets fail with `401`. Comparison uses
fixed-length SHA-256 digests and `timingSafeEqual`. Responses are private/no-store
and contain aggregate counts only.

Each invocation processes at most one source job and one document job, sequentially.
An exception in one queue does not prevent the other queue from progressing; a
partial invocation returns `503` so operational monitoring can see the failure.
Claims use row locking with `SKIP LOCKED`, attempt caps, delayed retries, six-minute
lease recovery, idempotent job keys, current-revision/entitlement checks, private
read-back verification, and atomic document publication. Overlapping or missed
scheduler calls therefore do not authorize duplicate current outputs.

At one document per scheduled minute, an eleven-output Executive package needs at
least 11 successful invocations (about 11 minutes) after readiness, before retries,
other clients, cold starts, or queue contention. The theoretical ceiling is 60
successful documents/hour for this schedule. Capacity must be measured rather than
increased speculatively.

Required Vercel environment variable names:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon fallback)
- `SUPABASE_SECRET_KEY` (or the legacy service-role fallback)
- `SECURITY_RATE_LIMIT_KEY`
- `AUTOMATION_WORKER_SECRET`

Required Supabase Vault secret names:

- `zevantaa_automation_worker_url`
- `zevantaa_automation_worker_token`

The scheduler migration installs/uses `pg_cron`, `pg_net`, and `supabase_vault`,
validates an exact HTTPS URL ending in `/api/internal/automation`, sets an HTTP
timeout of 290 seconds, and defines a once-per-minute named job
`zevantaa-automation-worker`. The migration does not schedule the job. Scheduler
control functions are revoked from browser roles and `service_role`; a database
owner must activate or stop it deliberately.

### Hosting and activation gates — MANUAL/BLOCKER

- In the actual Zevantaa Vercel project, record plan, Fluid Compute status, region,
  memory, concurrency, and maximum function duration. Current Vercel limits vary by
  plan/configuration; the route's 300-second declaration and Supabase's 290-second
  HTTP timeout are not proof that the deployed plan permits either. A commercial
  Zevantaa deployment must use a plan whose terms and limits support it.
- Run representative extensive-profile PDF work under preview and prove p95 and
  worst-case execution finish below the 290-second caller timeout with margin.
- Verify production variables by name and environment scope without printing values.
  Run `npm run environment:validate -- production` inside the configured release
  environment.
- Verify the three extensions, owner-only function ACLs, Vault names (not decrypted
  values), no pre-existing duplicate Cron job, and monitoring access to
  `cron.job_run_details` plus the relevant `net` response records.

Safe activation after deployment and smoke tests, with separate explicit approval:

1. Generate one independent random 32+ character worker secret.
2. Store it as server-only `AUTOMATION_WORKER_SECRET` in Vercel Production.
3. Store the exact worker HTTPS URL and matching token under the two Vault names.
4. Send one authenticated manual worker request from a trusted operator context;
   verify no candidate data is logged and one bounded item from each eligible queue
   progresses.
5. As database owner, run only:
   `select public.configure_zevantaa_automation_schedule();`
6. Verify exactly one active named job, successful Cron/HTTP records, lease recovery,
   and expected bounded queue drain.

Safe emergency shutdown stops new calls without deleting queue/history data:

```sql
select public.disable_zevantaa_automation_schedule();
```

Then verify the named job is absent/inactive. Existing leases must be allowed to
expire or finish. If authentication is suspected compromised, coordinate rotation
of the Vercel and Vault token; do not log the old or new value. Do not truncate
queues, delete failed jobs, or remove document history during shutdown.

## 5. UI/UX review

### Verified implementation

- Admin and client portals share one branded shell, active navigation, skip link,
  visible focus treatments, route-level loading skeletons, pending-navigation
  feedback, reduced-motion handling, responsive layouts, and a bounded scroll-to-top
  control.
- Priority admin/client screens use a shared accessible page-header system. Admin
  workflow visibility reads genuine invitation, extraction, queue, publication,
  and controlled error states; it does not simulate progress percentages.
- Directory filters expose loading status, wide operational tables keep overflow
  inside a focusable container, and forms associate validation errors with controls.
- Authorization and server-side data ownership remain in protected layouts/services;
  the UI changes do not replace RLS or role checks.
- Request-scoped authorization/branding now start concurrently, and the admin client
  list no longer performs one Auth Admin lookup per client. Production latency and
  hydration were not simulated or claimed.

### Remaining defects and manual QA

- **BLOCKER:** `/admin/pdf-render-test`, its download route, and
  `/client/extraction-test` remain production-compiled QA routes. They are protected,
  but the existing security model identifies them as temporary. Remove or explicitly
  production-feature-gate them in a separately reviewed change, then regression-test
  route denial.
- **BLOCKER:** complete authenticated browser QA at 390 px, 768 px, 1024 px,
  1365×768, and 1440×900, including keyboard-only use, 200% zoom, screen reader,
  color contrast, touch targets, real mobile file pickers, and horizontal overflow.
- **HIGH:** the mobile menu closes on Escape but does not trap focus, restore focus
  to the opener, or lock background scroll. Test and remediate before claiming a
  modal-style accessible mobile navigation.
- **DEFECT:** the scroll-to-top arrow in `dashboard-shell.tsx` is mojibaked and
  will render incorrectly. Correct it in a separate focused code change.
- **HIGH:** there are no App Router `error.tsx` boundaries. Confirm that failed
  protected queries/actions give a useful recoverable experience instead of only a
  framework error page.
- **MANUAL:** measure preview and production server response p50/p95, Supabase query
  timings, hydration, transferred route chunks, cold starts, and repeated requests.
  Local compilation and aggregate chunk data do not establish a performance SLO.
- **OPTIONAL:** split the large shared stylesheet and add automated browser-level
  accessibility/visual tests after release gates are closed; do not turn this into
  a V1 redesign.

## 6. Document-engine verification

### Verified from code and regression tests

The frozen output set remains exactly eight resumes and three cover letters:

1. Global ATS Resume
2. Domestic Resume 1 — Royal Navy & Gold Boardroom
3. Domestic Resume 2 — Contemporary Executive Sidebar
4. Domestic Resume 3 — Editorial Prestige Masthead
5. Domestic Resume 4 — Split-Grid Executive
6. Domestic Resume 5 — Executive Gold Accent
7. GCC / Middle East Resume
8. Europass / European Resume
9. General Corporate Cover Letter
10. International Relocation Cover Letter
11. Technology & Startup Cover Letter

All seven packages use one frozen entitlement function. Executive All-Inclusive
receives exactly all 11 outputs; other packages receive only declared resume
families. Readiness/package changes enqueue entitled outputs through the existing
durable queues. Job uniqueness, source revision, current entitlement, and atomic
publication prevent duplicate or stale current documents. Downgrades prevent client
access to no-longer-entitled outputs while historical records remain available to
authorized administration.

Templates consume only the canonical structured profile mapping. Optional fields
are omitted; no sample candidate value, achievement, qualification, date, visa,
nationality, work right, CEFR score, notice period, or education equivalence is
invented. Generated PDFs are signature/size checked, written to the private
`candidate-documents-private` bucket without public URLs, downloaded and SHA-256
verified, and published as versioned records. Client/admin download services recheck
role, ownership, current entitlement, revision, and private metadata. ATS snapshots
retain algorithm version and provenance; the score remains indicative.

The current full suite rendered/search-checked representative complete, sparse,
stress, and special-character fixtures for all outputs and passed. Milestone 3.1's
rasterized 44-document matrix recorded 97 pages with no page below its non-first-
page occupancy gate; its normal outputs were 2 pages for each resume and 1 page for
each letter. Those ignored fictional artifacts are historical local QA evidence,
not proof of the present production renderer/Storage runtime. Human preview review
and live private read-back remain mandatory.

### Known content/design gaps

- No approved Technology & Startup HTML/PDF reference exists. The existing category
  was polished but intentionally not substituted with another design.
- The structured profile has no verified nationality, visa/work-rights, notice
  period, recipient/company/address, exact application date, CEFR, or education-
  equivalence fields. GCC and European outputs omit them instead of inventing them.
- European output is a European-format presentation, not a claim of official
  Europass validation.
- Exact reference fonts are not bundled; selectable fallback-safe PDF text takes
  priority over host-dependent typography.
- **BLOCKER:** preview must prove all 11 outputs automatically generate and download
  through private Storage for short, normal, and extensive fictional clients, with
  version replacement, historical admin access, downgrade denial, ATS snapshot,
  long identity/URL, Unicode, missing optional fields, and a retry/lease failure.

## 7. Ordered production release checklist

### A. Pre-release prerequisites

- [ ] **BLOCKER — MANUAL:** approve a change window, named release owner, database
  owner, Vercel owner, rollback owner, and private evidence location.
- [ ] **BLOCKER — MANUAL:** create and verify a complete database/Auth-compatible
  backup plus all private Storage bucket objects; record counts and checksums outside
  GitHub. Complete an isolated restore drill. Do not treat a database-only dump as a
  Storage backup.
- [ ] **BLOCKER — MANUAL:** confirm Supabase project reference, Vercel project/domain,
  Zevantaa ownership, plan, region, and separation from preview/staging.
- [ ] **BLOCKER:** resolve/feature-gate QA-only routes and the expired-invite recovery
  path; fix the visible scroll-arrow defect; rerun validation.
- [ ] **VERIFIED:** reviewed commit is based on current `develop` and local checks
  below are green. Reconfirm branch/commit/clean tree immediately before release.

### B. Database migration preflight and application

- [ ] **BLOCKER — MANUAL:** run the read-only SQL above and archive aggregate counts,
  migration history, object signatures, ACL/RLS, trigger, index, and constraint
  evidence.
- [ ] **BLOCKER — MANUAL:** prove exact equivalence of the six manually executed
  migrations. Do not replay or falsify history. Approve a forward reconciliation if
  any body/signature/ACL differs.
- [ ] **MANUAL:** confirm no active/failed long-running transaction, no duplicate
  scheduler job, and sufficient change-window monitoring.
- [ ] **MANUAL, explicit approval required:** apply only
  `20261111085249_client_onboarding_invitation_state.sql` after the six-file
  equivalence decision. Never reset the database.
- [ ] **BLOCKER — MANUAL:** rerun postflight and compare aggregate Auth/admin/client/
  file/document counts exactly. Verify the new table is empty, constrained, RLS-
  enabled, and service-role-only before deploying application code.

### C. Required configuration

- [ ] **BLOCKER — MANUAL:** configure exact Site URL/callback allowlist, custom SMTP,
  invite/reset templates, password/OTP/rate-limit/security settings, and provider
  MFA without recording secret values.
- [ ] **BLOCKER — MANUAL:** configure the six effective Vercel environment inputs in
  Production scope only. Confirm public keys are browser-safe and server keys are
  never `NEXT_PUBLIC_*`.
- [ ] **MANUAL:** validate the configured environment in a protected release job.
  Do not print values.
- [ ] **BLOCKER — MANUAL:** prove Vercel duration/concurrency/memory/plan compatibility
  with an extensive fictional PDF workload.

### D. Preview deployment QA

- [ ] Deploy the exact reviewed commit to an isolated preview using non-production
  Supabase/Auth/SMTP/Vault values. Do not point preview at production data.
- [ ] Run admin/client login, logout, refresh, disabled-user, wrong-role, cross-client
  IDOR, newest/expired/reused invite and recovery links, and second-device setup.
- [ ] Run responsive, keyboard, screen-reader, zoom, contrast, error/loading, and
  navigation-performance checks listed above.
- [ ] Create a fictional client and execute upload → extraction → targeted needs-input
  correction (when required) → all entitled jobs → private downloads → ATS snapshot.
- [ ] Run Executive (11 outputs), package upgrade/downgrade, duplicate trigger,
  stale revision, failed job, retry, expired lease, scheduler outage/recovery, and
  historical-version tests. Inspect every PDF page visually.
- [ ] Verify logs contain no candidate content, token, object key, credential, or
  plaintext password; alerts expose controlled actionable codes only.

### E. Production deployment

- [ ] Obtain explicit production approval after all blockers and preview evidence.
- [ ] Reconfirm backup, target IDs, commit SHA, environment scopes, migration
  postflight, rollback owner, and scheduler still inactive.
- [ ] Deploy the exact immutable reviewed commit. Do not merge as part of the deploy
  unless separately approved; do not rebuild from an unreviewed working tree.
- [ ] Keep the scheduler disabled. Run application/Auth/private-Storage smoke tests
  first with a new fictional client and a second browser/device.
- [ ] Confirm admin directory/workflow, client dashboard/profile/intake/editor/library/
  ATS screens, download authorization, one current version per output, and no cross-
  client access.

### F. Scheduler activation and acceptance

- [ ] With separate explicit approval, configure matching Vercel/Vault worker secrets,
  manually invoke one bounded request, and inspect queue/HTTP evidence.
- [ ] Activate exactly one named minute schedule through the owner-only function.
- [ ] Observe at least one complete 11-output package, a retry, a lease recovery, an
  idle cycle, and a missed/failed scheduler cycle without duplicate publication.
- [ ] Record p50/p95/worst duration, queue drain time, failure codes, private object
  verification, and Cron/network status. Establish operational alert owners.
- [ ] Obtain business, security, operations, document-quality, and release-owner
  acceptance. Only then change the release verdict to GO.

## 8. Rollback and recovery

Application rollback: disable the scheduler first, preserve queue/history rows, and
redeploy the last known-good immutable commit. The additive onboarding table can
remain. If the previous app cannot tolerate a newly applied schema, use a reviewed
forward compatibility repair rather than dropping evidence.

Database recovery: stop scheduler calls and application mutations, capture logs and
counts, and restore the verified backup into isolated non-production infrastructure
first. Validate Auth linkage, roles, RLS/grants, private Storage object counts and
checksums, current/superseded document uniqueness, queue leases, and download denial
before any production restoration decision. Never use `db reset`, destructive
rollback SQL, or a first-time restore directly over production.

Email/Auth emergency: stop new client invitations at the application/release layer,
preserve delivery rows, revoke/rotate only the suspected provider secret through its
owned secret manager, and retest invitation/recovery on a fictional account. Do not
delete Auth users or ledger rows to clear an error state.

Worker emergency: call the owner-only disable function, verify the Cron job is no
longer active, allow leases to expire, and rotate the worker token in Vercel and
Vault together if compromised. Do not delete failed jobs or published history.

## 9. Validation evidence

Executed at audited commit before this documentation-only change:

| Check | Result |
| --- | --- |
| Full test suite (`npm test`) | **Passed: 408/408**, 0 failed/skipped |
| ESLint (`npm run lint`) | **Passed** |
| TypeScript (`npx tsc --noEmit`) | **Passed** |
| Production build (`npm run build`) | **Passed**; all app routes compiled |
| Secret scan (`npm run security:secrets`) | **Passed**; no configured high-confidence pattern found |
| Production dependency audit (`npm audit --omit=dev`) | **Passed**; 0 vulnerabilities |
| Diff whitespace check | **Passed** |

The test run emits existing non-failing Node module-type warnings and PDF.js
standard-font-data warnings. They do not fail extraction/render checks, but should be
tracked as test-harness quality work rather than hidden. The first dependency audit
attempt was denied registry/cache access by the sandbox; the same read-only audit was
rerun with approved registry access and completed successfully.

## 10. Final blocker/optional classification

Mandatory blockers before production:

1. Verified backup plus isolated restore evidence.
2. Six manually executed migration bodies/signatures/ACLs reconciled without replay
   or fabricated history; onboarding migration then applied and verified.
3. Exact Zevantaa Auth URL, custom SMTP, templates, password/OTP/rate limits, and
   provider security settings configured and tested.
4. Expired `sent` invitation recovery proven or safely implemented.
5. QA-only production routes removed/feature-gated and authenticated cross-role/
   cross-client/browser accessibility QA completed.
6. Actual Vercel plan/runtime and 290-second worker margin proven.
7. Live private Storage/RLS/download/versioning, all 11 automatic outputs, package
   change, retry/lease/stale/duplicate, ATS snapshot, and scheduler-failure tests.
8. Privileged-provider MFA and application-admin MFA risk decision recorded.
9. Separate explicit approvals for production deployment and scheduler activation.

Optional enhancements after mandatory gates:

- Split the shared stylesheet and add browser-level visual/accessibility automation.
- Remove current Node module-type and PDF.js test-harness warnings.
- Add an approved Technology & Startup design reference and verified regional fields
  only through a separately scoped schema/product decision.
- Establish measured performance budgets and capacity alerts from real preview/live
  observations.

## Authoritative external references

- Supabase custom SMTP: <https://supabase.com/docs/guides/auth/auth-smtp>
- Supabase redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
- Supabase email templates: <https://supabase.com/docs/guides/auth/auth-email-templates>
- Supabase password security: <https://supabase.com/docs/guides/auth/password-security>
- Supabase invitation API: <https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail>
- Supabase Auth users/invite expiry: <https://supabase.com/docs/guides/auth/users>
- Supabase Auth rate limits: <https://supabase.com/docs/guides/auth/rate-limits>
- Supabase Vault: <https://supabase.com/docs/guides/database/vault>
- Supabase Cron: <https://supabase.com/docs/guides/cron>
- Supabase changelog: <https://supabase.com/changelog.md>
- Vercel function limits: <https://vercel.com/docs/functions/limitations>

