# Milestone 4 operational readiness

This report covers local implementation only. No production Supabase setting,
secret, migration, Cron job, Vercel deployment, or live record was changed.

## Onboarding audit and implementation

The previous workflow did not send an onboarding email. It created a confirmed
Auth user with a temporary password and prepared browser `mailto:`/WhatsApp
drafts for an administrator to send manually. A WhatsApp draft could therefore
be sent while no email was ever transmitted.

The replacement uses the server-only Supabase Auth invitation API and a private
delivery ledger. The administrator sees actual `not-sent`, `pending`, `sent`,
or `failed` state. A failed attempt is claimed by a conditional state update
before retry, so a pending or successful invitation cannot be sent twice. Auth
user, client role, and candidate profile remain one-to-one. Passwords and invite
tokens never enter form state, application logs, analytics, or database rows.

External configuration required before live use:

1. Apply the new forward migration after backup and preflight.
2. Configure custom SMTP in the Zevantaa Supabase project.
3. Allowlist the exact invitation callback URL.
4. Configure the Invite User token-hash template in `AUTH_CONFIGURATION.md`.
5. Keep `NEXT_PUBLIC_APP_URL`, Supabase server secret, and public project values
   in the hosting environment; never commit them.
6. Send a fictional test invitation and confirm provider logs, inbox delivery,
   one-time activation, password setup, sign-out, and subsequent client login.

## Navigation performance evidence

The code-path audit found these database/network round trips before this change:

| Path | Prior behavior | Current behavior |
| --- | --- | --- |
| Admin/client shell | Role authorization completed before branding started | Request-scoped authorization and public-safe branding start concurrently; React request cache still deduplicates nested reads |
| Provisioned-client list | One Auth Admin lookup per client after the role/profile query | Uses authoritative `candidate_profiles.primary_email`; removes the Auth N+1 waterfall |
| Client dashboard | Profile read, five parallel state reads, verified-file read | Retained: three bounded rounds; document metadata is loaded only for the linked client and entitlement checks |
| Admin directory | Bounded 200-row scans and 25-row display page | Retained caps; live latency must be measured before replacing the current safe scan with indexed server search |

The production build is the source of truth for route compilation and client
chunks. Real server-response p50/p95, hydration timing, Supabase query duration,
cache behavior, and Vercel cold starts require the deployed Zevantaa environment
and fictional traffic; local tests cannot honestly substitute those values.
The clean local optimized build compiled in 4.1 seconds. Its build artifact
contained 22 JavaScript chunks totalling 949,431 uncompressed bytes; the largest
single chunk was 245,434 bytes. That aggregate includes shared and route-specific
chunks and is not a claim that any one navigation transfers the full amount.

## Automation reliability audit

Verified in code and regression tests:

- Resume replacement enqueues one source-processing job per source file.
- Source extraction is bounded and conservative; ambiguous or existing profile
  merges become `needs-input` rather than invented facts.
- Package reconciliation enqueues exactly the newly entitled outputs and the
  Executive package retains eleven output kinds.
- Queue claims use `FOR UPDATE SKIP LOCKED`, attempt caps, expiring leases, and
  delayed retry timestamps.
- Publication checks the active lease, current career revision, package, output
  entitlement, and unique version before atomically superseding the prior copy.
- Generated files remain in the private documents bucket; historical records
  remain stored while client download checks only current entitlement/revision.
- ATS assessment snapshots retain algorithm version and provenance.
- The worker authenticates with a constant-time compared bearer secret, runs
  one bounded job per queue per invocation, and lets the other queue progress
  if one queue fails.
- A failure is now counted only when the lease-bound failure RPC returns `true`.
  Stale/unentitled and invalid-claim failures retain actionable controlled codes.

The scheduler remains intentionally inactive in migrations. Live verification
still requires the Zevantaa Vercel runtime, worker secret, Supabase Vault values,
and Cron configuration; none were changed here.

## Readiness classification

### Fully implemented and locally tested

- Admin-only secure invitation creation and safe failed-delivery retry.
- No plaintext password onboarding path.
- Invite/recovery callback and one-time password setup proof.
- Durable onboarding state, RLS, service-role-only table permissions.
- Admin workflow page with genuine onboarding, extraction, generation,
  publication, and controlled failure records.
- Queue failure acknowledgement and error provenance fixes.
- Request waterfall and Auth N+1 reductions.

### Implemented but requiring external configuration

- Production invitation delivery: custom SMTP, sender/domain verification,
  allowlisted redirect, invite template, and hosting environment variables.
- New onboarding migration application.
- Worker: Vercel secret and Supabase Vault/schedule activation.

### Requiring live end-to-end testing

- Provider acceptance versus actual inbox delivery and spam placement.
- New client activation on a second device and expired-link behavior.
- Upload through automatic extraction, targeted needs-input correction, all
  entitled output publication, download, version replacement, and ATS snapshot.
- Eleven-document Executive queue drain time, retry recovery, Vercel duration,
  concurrent requests, and Cron outage recovery.
- Vercel/Supabase p50/p95 latency, hydration, cold-start, and bundle transfer.

### Remaining blockers

- Production SMTP and sender identity are not configured or verifiable locally.
- The forward migration is not applied to production.
- Production worker secret, Vault entries, and Cron schedule remain inactive.
- No production-like load or live delivery test is authorized in this milestone.
