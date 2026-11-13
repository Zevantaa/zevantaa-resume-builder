# Complete client experience, administration and ATS enhancement

Prepared on 2026-11-13 from branch
`feature/client-experience-admin-ats-enhancement`. This report records local
implementation and validation only. It is not evidence of a production
migration, SMTP delivery, deployment or Cron activation.

## Implemented

- Added an administrator-only Client Access Details workspace with genuine
  account, package, invitation and activation state; reliable copy controls;
  manually selectable prepared messages; invitation retry; and a one-time
  Supabase recovery/setup link. Existing passwords are never retrieved,
  persisted or logged.
- Added compact responsive intake and career layouts, collapsible managed
  details, sticky save behavior, invalid-upload focus, unsaved-change guards,
  reduced-motion support and mobile fallbacks without removing fields.
- Added durable document-linked ATS assessments. The worker downloads the exact
  private original/generated file, extracts searchable text, applies the same
  deterministic versioned 0–100 method, and stores provenance, dimension scores
  and explainable findings. All eight resume output kinds are eligible; cover
  letters and privacy-masked exports are excluded.
- Added a genuine Original vs Optimized comparison to the client dashboard, ATS
  page, document library and administrator client profile. Missing, pending,
  failed and unavailable assessments are represented honestly.
- Added recoverable 30-day client archive, Auth suspension, processing stop,
  archived-client administration and restoration. Added separately gated,
  typed-confirmation permanent deletion with scoped private-object removal,
  explicit table cleanup, active-job refusal and durable lifecycle evidence.
- Enabled RLS as defense in depth on the remaining legacy public application
  tables. Browser-role table privileges remain revoked and the new lifecycle
  and document-ATS tables grant access only to `service_role`.
- Updated the encrypted release orchestrator to accept only the two pending
  approved forward migrations, in order, and never replay an already recorded
  version.

## Database migration

New forward-only migration:

`supabase/migrations/20261113052443_complete_client_experience_admin_ats.sql`

It must run after
`20261111085249_client_onboarding_invitation_state.sql`. The migration is
transactional and preserves existing Auth users, administrator/client roles,
candidate profiles, source files, generated documents and historical ATS
snapshots. It adds a recovery timestamp, three private service-role tables,
bounded queue functions, lifecycle RPCs, enqueue triggers and resume-assessment
backfill rows. The backfill creates pending work only; it does not fabricate
scores or alter document bytes.

## Validation evidence

- Complete regression suite: **429 passed, 0 failed**.
- TypeScript (`tsc --noEmit`): **passed**.
- ESLint: **passed**.
- Next.js production build: **passed**.
- Secret scan: **passed**.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- Pinned Supabase CLI 3.1.0 local rebuild: **all 23 migrations applied**.
- Local read-only schema assertions: **0 public tables without RLS**, **0**
  `anon`/`authenticated` grants on the three new tables, **3/3** service-role
  grants, **2/2** enqueue triggers and **0** invalid new constraints.
- Supabase database lint: the new migration produced no finding. One pre-existing
  warning remains in `public.publish_generated_document` concerning assignment
  of text to `resume_format_family`; the full migration rebuild and document
  regression suite pass.

## Production gates and limitations

1. Do not apply either forward migration until the encrypted database and all
   three private Storage bucket backups have been restored and checksum-verified
   in the isolated memory-only Docker target.
2. The local DPAPI age identity and an independently stored offline post-quantum
   recovery identity are mandatory. A public offline recipient alone is not
   sufficient; recovery with the offline private identity must be demonstrated.
3. Custom SMTP remains externally configured. Keep `ZEVANTAA_SMTP_VERIFIED=false`
   until a real production invitation has been delivered and activated.
4. Keep `ZEVANTAA_PERMANENT_DELETION_ENABLED=false` for initial release. Enable
   it only after controlled production archive/restore, backup recovery and
   fictional-client deletion validation.
5. Cron remains inactive until worker/Vault secret equivalence and an
   authenticated manual invocation pass without duplicate processing.

No production database, Storage object, credential, scheduler or deployment was
changed while preparing this implementation.
