# Milestone 5B release hardening

- Hardening date: 11 November 2026
- Repository: `Zevantaa/zevantaa-resume-builder`
- Branch: `feature/premium-uiux-document-upgrade`
- Starting commit: `d182fda1f97adc71ee1a2a81296894b54e21ee3a`
- Target Supabase project for a future approved release: `fzltowzpfrnuxxxrzuih`

No production record, database object, migration history, Auth setting, secret,
Cron schedule, Vercel deployment, or provider configuration was read or changed
during this milestone. This work is limited to source, tests, and documentation on
the existing feature branch.

## Readiness recommendation

**GO for isolated preview validation; NO-GO for production activation.** All code-
level blockers identified by the Milestone 5A audit are resolved and the complete
local validation matrix is green. Production remains blocked by provider and live-
environment evidence that cannot be established from source: verified backup and
restore, six-migration equivalence, migration application, Auth/SMTP configuration,
actual Vercel runtime limits, private Storage/RLS tests, full browser accessibility,
and production-like end-to-end automation. Deployment and scheduler activation
still require separate explicit approval.

## 1. Defects fixed

### Production QA exposure

- Inventoried the development-only browser and server entry points:
  `/admin/pdf-render-test`, `/admin/pdf-render-test/download`,
  `/client/extraction-test`, the extraction QA action, and the PDF-generation QA
  action.
- Added one server-only, fail-closed gate. QA utilities require
  `ENABLE_QA_UTILITIES=true` and an explicit local/development or preview
  deployment. A production deployment cannot enable them even if the flag is set.
- Disabled browser routes return a generic `404` with `Cache-Control: private,
  no-store` before authorization, profile loading, extraction, rendering, or file
  access. Direct server-action invocation is gated independently.
- Added a production environment validation failure for an enabled QA flag. The
  flag has no `NEXT_PUBLIC_` form and is not sent to the browser.
- Preserved controlled QA for local tests and isolated Vercel previews. For preview
  use, set `ENABLE_QA_UTILITIES=true` only in Preview scope and ensure
  `VERCEL_ENV=preview` (or `DEPLOYMENT_ENV=preview`). Leave it false or absent in
  Production.

The optimized build still compiles the route modules, as expected for a runtime
feature gate. Their production behavior is nevertheless a hard 404 and cannot be
overridden by the QA flag.

### Mobile navigation accessibility

- Opening the compact menu moves keyboard focus to its first navigation control.
- Tab and Shift+Tab remain within the open menu; Escape dismisses it.
- Closing restores focus to the menu opener and restores the previous body-scroll
  state.
- A closed compact sidebar is both `aria-hidden` and `inert`, so hidden links are
  unavailable to assistive technology and keyboard navigation.
- The opener retains `aria-controls`, a live `aria-expanded` value, and an
  action-specific accessible label. Desktop navigation remains permanently usable.
- A breakpoint change closes the compact menu safely instead of leaving modal
  behavior active on desktop.

### Character and rendering defects

- Replaced the fragile scroll-to-top Unicode arrow with a reusable decorative SVG
  icon component.
- Replaced fragile ATS direction glyphs with the same code-native icon system.
- Corrected malformed ellipses and separators in client intake, resume editing,
  and ATS presentation copy.
- Removed the malformed literal from the historical Milestone 5A report.
- Added a recursive source regression check for the known mojibake byte patterns.

### Expired invitation recovery

- Added an administrator-only, durable resend path for a sent but unaccepted client
  invitation and for a linked failed delivery.
- The service revalidates the active client role, candidate profile, Auth user,
  normalized email, attempt ceiling, and unaccepted state before delivery.
- An unconfirmed Auth user receives a fresh Supabase invitation. A confirmed user
  whose setup is incomplete receives the existing secure password-recovery flow.
  The service never deletes the Auth user, creates a second client, or relinks the
  candidate role.
- A conditional `sent`/`failed` to `pending` database claim occurs before the email
  provider call. Concurrent requests therefore permit only one send. Success and
  controlled failure are written back to the durable invitation ledger.
- The administrator workflow now exposes genuine awaiting-setup and failed states
  with a safe retry control. It does not expose a token, password, private object
  key, Auth user ID, or provider error text.
- Accepted, disabled, archived, mismatched, over-limit, pending, and otherwise
  invalid invitations fail closed.

Supabase documents that expired invitations require a new invitation and that
invite links use the configured Email OTP expiry. The implementation follows that
provider model without handling plaintext passwords. Production still requires
live SMTP and newest/expired/reused-link testing.

### Failure recovery and empty-state resilience

- Added root, administrator, and client App Router error boundaries.
- Recovery screens focus a semantic heading, offer a framework reset and a safe
  portal-home link, and use restrained branded styling.
- Candidate exception messages, stacks, digests, identifiers, and query details are
  never rendered to the browser.
- Existing loading and empty states remain in place; no simulated progress or
  unauthorized fallback data was introduced.

## 2. Security and privacy review

### Verified in source and tests

- Admin and client layouts still enforce their server-side role requirements.
- The new invitation action delegates authorization to the admin-only service;
  malformed identifiers are rejected before service access.
- Invitation resend rechecks durable ownership/role linkage and uses conditional
  state updates to prevent duplicate provider calls.
- Invite/recovery callback construction still uses the configured canonical app
  origin; it does not trust a request host or accept an arbitrary return URL.
- QA access is server-only, production-disabled, private/no-store, and checked at
  every direct route/action boundary.
- Error boundaries and action results expose controlled copy rather than sensitive
  provider or database errors.
- No service-role key, candidate content, private document URL, Auth token, or
  password was added to client code, logging, analytics, or documentation.
- Existing RLS, private buckets, package checks, document download authorization,
  publication/versioning, and worker authentication were not weakened or bypassed.

### Remaining live verification

- Cross-client IDOR denial, disabled-account behavior, and private Storage/RLS must
  be exercised against a production-like preview project.
- Supabase and Vercel log retention/redaction must be inspected for tokens, profile
  data, object keys, and provider errors.
- Provider MFA remains a mandatory operational control. Application-admin MFA is a
  recorded release-owner risk decision because adding a new authentication factor
  is outside this focused V1 hardening change.

## 3. Compatibility assessment

No database schema, migration, package-routing rule, output identifier, renderer,
queue claim function, storage path, publication function, versioning rule, or ATS
algorithm was changed in Milestone 5B.

The full regression suite confirms that the following existing behavior remains
intact:

- all seven package entitlement configurations;
- exactly eight resume outputs and three cover letters;
- automatic extraction/readiness and entitled-output processing;
- bounded queue claims, retries, stale-revision rejection, and duplicate prevention;
- private generated-document access and SHA-verified publication;
- current and historical document version integrity;
- indicative ATS calculation and snapshot provenance;
- administrator controls, client ownership, and account isolation; and
- existing client/Auth/role records, because this milestone applies no migration or
  data mutation.

The PDF regression matrix rendered complete, sparse, stress, and special-character
profiles for every output. Existing non-failing PDF.js standard-font and Node module-
type test-harness warnings remain documented quality items, not release failures.

## 4. Files changed

### Configuration and release controls

- `.env.example`
- `scripts/run-tests.mjs`
- `scripts/validate-environment.mjs`

### QA access boundaries

- `src/lib/qa-utilities.ts`
- `src/app/admin/pdf-render-test/page.tsx`
- `src/app/admin/pdf-render-test/download/route.ts`
- `src/app/client/extraction-test/page.tsx`
- `src/features/document-generation/extract-resume-for-qa-action.ts`
- `src/features/document-generation/pdf/generate-pdf-for-qa-action.ts`

### Navigation, UI, and error recovery

- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/ui/icons.tsx`
- `src/components/ui/route-error.tsx`
- `src/components/ui/index.ts`
- `src/app/error.tsx`
- `src/app/admin/error.tsx`
- `src/app/client/error.tsx`
- `src/app/globals.css`
- `src/app/client/resume-input/page.tsx`
- `src/features/client-portal/client-resume-input-forms.tsx`
- `src/features/document-generation/indicative-ats-panel.tsx`

### Invitation recovery and operational visibility

- `src/features/admin-portal/client-account-service.ts`
- `src/features/admin-portal/welcome-message.ts`
- `src/features/admin-portal/admin-workflow-service.ts`
- `src/features/admin-portal/admin-workflow-page.tsx`
- `src/features/admin-portal/retry-client-invitation-action.ts`
- `src/features/admin-portal/invitation-retry-button.tsx`

### Tests and documentation

- `tests/assur-01-environment.test.mjs`
- `tests/fnd-05-07.test.mjs`
- `tests/ops-milestone4.test.mjs`
- `tests/ops-milestone5b.test.mjs`
- `docs/AUTH_CONFIGURATION.md`
- `docs/PRODUCTION_ENVIRONMENT_MATRIX.md`
- `docs/MILESTONE_5A_PRODUCTION_READINESS.md`
- `docs/security/ACCESS_CONTROL_MATRIX.md`
- `docs/security/RESIDUAL_RISK_REGISTER.md`
- `docs/security/SEC_01_GO_NO_GO.md`
- `docs/MILESTONE_5B_RELEASE_HARDENING.md`

## 5. Validation evidence

| Check | Result |
| --- | --- |
| Full regression suite (`npm test`) | **Passed: 416/416**, 0 failed, skipped, or cancelled |
| Focused Milestone 5B tests | **Passed** as part of the complete suite |
| ESLint (`npm run lint`) | **Passed** |
| TypeScript (`npx tsc --noEmit`) | **Passed** |
| Optimized production build (`npm run build`) | **Passed** |
| Local environment validation (`npm run environment:validate`) | **Passed**; remote configuration remains manual |
| Secret scan (`npm run security:secrets`) | **Passed**; no configured high-confidence secret pattern found |
| Production dependency audit (`npm audit --omit=dev`) | **Passed: 0 vulnerabilities** |
| Whitespace/error check (`git diff --check`) | **Passed**; only Git line-ending notices were emitted |

Focused coverage includes production/preview/local QA-gate combinations, generic
404/no-store behavior, direct action gating, production environment rejection,
mobile focus movement/trapping/restoration, Escape dismissal, inert hidden content,
source encoding, generic error boundaries, authorization delegation, linked and
unlinked invitation retries, confirmed and unconfirmed users, accepted-state
rejection, and concurrent-send prevention.

## 6. Remaining blockers and required manual actions

The following are not code defects that can be closed safely in this branch:

1. **Backup and recovery:** create and checksum the complete database/Auth-compatible
   and private Storage backup outside GitHub, then prove an isolated restore.
2. **Migration equivalence:** reconcile the six manually executed automation
   migrations against live objects, bodies, signatures, ACL/RLS, constraints,
   triggers, and migration history without replay or fabricated history.
3. **Onboarding migration:** after approved preflight and backup, apply and verify
   only `20261111085249_client_onboarding_invitation_state.sql`. This milestone did
   not execute it.
4. **Auth and email:** configure the exact production Site URL/callback allowlist,
   custom SMTP, invite/recovery templates, password/OTP/rate limits, and test newest,
   expired, invalid, reused, confirmed, and unconfirmed setup flows on a second
   device.
5. **Hosting:** verify the actual Zevantaa Vercel plan, region, concurrency, memory,
   and 300-second route/290-second caller timeout margin with extensive profiles.
6. **Live security:** prove RLS, private bucket access, cross-client denial, disabled
   users, download authorization, log redaction, and provider MFA.
7. **Browser accessibility:** manually test authenticated flows at the audited
   breakpoints, keyboard-only, screen reader, 200% zoom, touch, contrast, real mobile
   file pickers, and navigation failure recovery.
8. **Automation E2E:** prove all 11 Executive outputs, other package entitlements,
   upgrade/downgrade, historical access, ATS snapshots, retry, stale jobs, duplicate
   triggers, lease recovery, missed scheduler calls, and private downloads in an
   isolated preview environment.
9. **Production authorization:** obtain separate approvals for migration,
   production deployment, worker secret configuration, and Cron activation.

## 7. Safe next sequence

1. Review this commit and run CI without production values.
2. Complete backup/restore and live read-only migration equivalence evidence.
3. Deploy the exact reviewed commit to an isolated preview with non-production data.
4. Enable QA utilities only in Preview scope for controlled document/extraction QA;
   verify the same URLs return 404 with the flag absent and always in Production.
5. Complete Auth/SMTP, browser/accessibility, security, and 11-output preview tests.
6. Reassess the remaining external blockers and record formal acceptance.
7. Only with new explicit approval, follow the Milestone 5A migration/deployment/
   scheduler sequence. Do not combine migration, app deployment, and scheduler
   activation into one unobserved step.

## Authoritative references

- Supabase Auth users and invitation expiry:
  <https://supabase.com/docs/guides/auth/users>
- Supabase admin invitation API:
  <https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail>
- Supabase email templates:
  <https://supabase.com/docs/guides/auth/auth-email-templates>
- Supabase custom SMTP:
  <https://supabase.com/docs/guides/auth/auth-smtp>
