# GitHub Issues #7, #8 and #9 — Release Readiness

Date: 2026-11-13

Branch: `feature/client-experience-admin-ats-enhancement`

Production project: `fzltowzpfrnuxxxrzuih`

## Status

Code-level fixes are implemented and locally validated. Production remains
unchanged. Migration, deployment and scheduler activation are blocked until the
existing encrypted-backup gate proves both database and private Storage recovery
with an independently protected age recovery identity.

## Read-only production evidence

The production query was explicitly pinned to `fzltowzpfrnuxxxrzuih` and made no
changes. It found:

- 11 document-regeneration jobs pending and no exhausted duplicate leases.
- 16 document-linked ATS assessment rows pending: 4 original sources and 12
  generated resumes.
- Zero missing original-assessment rows for current uploaded sources.
- Zero missing generated-assessment rows for available generated resumes.
- No Zevantaa automation Cron job or Cron run history.
- Neither required worker URL nor worker token Vault name is present.
- Production migration history records only the first 15 migrations, although
  the six automation schemas, invitation state, and document ATS tables are
  present. These must be reconciled only through the release orchestrator's
  schema-equivalence gate and official Supabase migration-repair command.

Therefore the screenshot states “Assessment pending”, “Not assessed”, and
“Document generation in progress” were not evidence of fabricated or missing
scores. The assessment rows exist, but no configured scheduler can invoke the
worker. No score was invented or backfilled manually.

## Implemented fixes

### Issue #7

- Added administrator-selectable secure email invitation or server-generated
  one-time temporary password.
- Temporary passwords use 192 random bits, are returned only in the immediate
  server-action response, are never written to application tables or logs, and
  set `must_change_password` in Auth app metadata.
- Added first-sign-in forced password replacement and a guarded administrator
  reissue action. Reissue replaces rather than retrieves a credential.
- Invitation UI now reports `provider-accepted` rather than claiming delivered
  email, while preserving durable not-sent, pending, sent and failed states.
- Existing token-hash/PKCE callback, canonical redirect origin, expired-link
  recovery and safe retry controls remain in place.
- Dashboard evidence queries remain parallelized. Worker throughput is increased
  from one to two bounded items per queue and invocation without changing lease,
  retry or idempotency rules.

### Issue #8

- Every successful source extraction now finishes in `needs-input`, even when
  deterministic parser confidence is high.
- The linked client's explicit confirmation is the normal generation boundary.
- Administrator resume processing is monitoring/support only; the page no
  longer exposes a confirmation mutation.
- The new forward migration restricts entitlement enqueueing to a confirmation
  tied to the current source file. Preserved legacy administrator-confirmed
  sources remain valid, but an unrelated historical review cannot unlock a
  replacement.
- Existing canonical facts remain untouched by extraction. Exact duplicates are
  marked already saved; likely key conflicts are highlighted before confirmation.

### Issue #9

- The review screen groups extracted proposals and exposes editable verified
  identity/contact fields. Auth-linked email remains read-only.
- Identity/contact corrections and selected extracted facts are committed in one
  database transaction through a service-role-only RPC.
- ATS comparison loads the newest available version of every generated resume
  variant, not only Global ATS, and compares only ready scores produced by the
  same algorithm version.
- The original and each generated resume remain assessed from their actual
  private file bytes. Unsupported text extraction produces `unavailable`, never
  an invented score.
- Dashboard status now distinguishes active generation, failed work, complete
  documents and publication pending from genuine persisted states.

## Forward migration

Apply only after backup/restore evidence and migration-history reconciliation:

1. `20261111085249_client_onboarding_invitation_state.sql`
2. `20261113052443_complete_client_experience_admin_ats.sql`
3. `20261113124500_client_confirmation_release_fixes.sql`

The third migration replaces one function and adds one service-role-only RPC. It
does not delete or rewrite accounts, Auth users, candidate facts, files,
documents, assessment rows, or historical versions.

## Validation

- Full regression suite: PASS — 433 tests.
- Focused Issues #7–#9 regression coverage: PASS.
- ESLint: PASS.
- TypeScript: PASS.
- Next.js production build: PASS, including `/change-password`.
- Secret scan: PASS.
- Production dependency audit: PASS — zero known production vulnerabilities.
- Local migration-container execution: BLOCKED in this agent environment because
  the Docker CLI is not on the available PATH. No production SQL was used as a
  substitute.

## Mandatory production sequence

1. Establish encrypted database and all three private Storage bucket backups,
   then prove isolated restore using both the local DPAPI identity and the
   independently stored offline recovery identity.
2. Prove live schema equivalence for the six manually applied automation
   migrations, then repair only their history with official Supabase tooling.
3. Dry-run and apply the three forward migrations in the order above.
4. Deploy the reviewed commit through feature branch → `develop` → `main` and
   the existing Zevantaa Vercel project.
5. Verify the worker rejects an unauthenticated call and accepts the matching
   secret without exposing it.
6. Add the exact worker URL/token Vault secrets, activate one scheduler job, and
   verify the existing 11 document jobs and 16 assessment rows are claimed
   idempotently rather than duplicated.
7. Run a fictional client end-to-end test and record genuine per-variant Before
   and After values only after assessment status is `ready`.

## Current blocker

No production action is authorized until the offline age recovery identity is
stored on a separate secure medium and Prepare mode produces verified encrypted
backup and isolated restore evidence. This is intentionally fail-closed.
