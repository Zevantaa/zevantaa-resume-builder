# REL-01 — Production preparation (no deployment)

Prepared 2026-10-24 on `develop` at `49f7de5f169c431ef3f8ef202b347f992ebe2290`. GitHub Quality and security run `40014134924` was reported green; this preparation did **not** deploy, merge `main`, change provider settings, or write to the remote database. Project examined: Supabase `gkxsrmsfapnmejfeyael`, healthy in `ap-south-1`. The project reference is not proof that it is the approved production tenant. [The variable matrix](PRODUCTION_ENVIRONMENT_MATRIX.md) is the authoritative REL-01 variable inventory.

## 01/05 — Environment and validation

The application uses `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (with code-only legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback), `SUPABASE_SECRET_KEY` (with code-only `SUPABASE_SERVICE_ROLE_KEY` fallback), and `SECURITY_RATE_LIMIT_KEY`. Browser-safe variables must never contain service-role/secret values. Vercel production values, approved HTTPS domain, DNS, environment separation, and exact Supabase-project/key match are not accessible from the repository and remain unverified. There is no evidence of a deployed production app.

`scripts/validate-environment.mjs` rejects missing/placeholder production values for the five required **effective** inputs, non-HTTPS or malformed URLs, credentials/query/fragment/non-root paths, localhost production origin, a secret-looking browser key, a publishable-looking server key, and rate keys shorter than 32 characters. It now accepts the app's legacy anon/service-role fallbacks only when the preferred variable is absent; an invalid preferred value cannot be hidden by a fallback. Local validation remains permissive for clean CI builds. Do not confuse a syntactic pass with a live provider/ownership check. Before deployment, run `npm run environment:validate -- production` with the target Vercel configuration without printing values. A clean CI build may run without Supabase secrets because protected portal routes are request-dynamic; production requests still require real configuration.

## 02 — Database and migration reconciliation

Read-only live inspection found 15 recorded migrations corresponding by **name and order** to all 15 repository SQL files. All 19 `public` tables have RLS enabled. The schema has 15 public enums, 12 public functions, 10 user triggers and 57 public indexes. The expected DOC-13 output kind/status enums, private-document tables/indexes and publication/job functions exist. `publish_generated_document` and `claim_document_regeneration_job` have service-role EXECUTE grants; `rls_auto_enable` is SECURITY DEFINER and has no anon/authenticated EXECUTE grant. Only `user_roles` has a public RLS policy (authenticated users can select their own role); the other 18 public tables have RLS with no policy and are accessed through trusted server paths. Supabase's current security advisor flags those 18 as informational and flags leaked-password protection as a warning. The performance advisor reports 20 unused indexes; do not drop them based on an unrepresentative pre-production workload.

The migration-history versions differ from repository filename versions on most rows. These are **not** absent schema changes. The exact mapping observed is:

| Migration name | Repository version | Remote history version |
| --- | --- | --- |
| `fnd_03_06_initial_v1_schema` | `20260917000100` | `20260918041421` |
| `fnd_03_07_relationships_and_constraints` | `20260918042037` | `20260918043836` |
| `fnd_03_07_cover_composite_foreign_keys` | `20260918044133` | `20260918053812` |
| `fnd_04_07_08_user_roles` | `20260925084040` | `20260925085140` |
| `fnd_05_03_link_client_auth_profiles` | `20260925090112` | `20260925091329` |
| `fnd_06_08_09_private_intake_bucket` | `20260927204914` | `20260927204914` |
| `doc_01_01_05_profile_model_integrity` | `20260928000100` | `20260928175256` |
| `admin_owned_profile_onboarding` | `20260929000100` | `20260929110227` |
| `doc_02_05_06_review_confirmation` | `20260929000200` | `20260929175147` |
| `doc_02_06_live_parser_fields` | `20260929000300` | `20260929184005` |
| `dsh_06_dynamic_career_updates` | `20261010184016` | `20261010191945` |
| `dsh_07_v8_editor_and_brand_settings` | `20261010203200` | `20261010210252` |
| `sec_01_least_privilege_and_audit` | `20261010212007` | `20261012065200` |
| `doc_13_persistent_documents` | `20261019064514` | `20261023190731` |
| `doc_13_document_lifecycle` | `20261019064608` | `20261023190738` |

For DOC-13 specifically, read-only hashes of the remote recorded SQL statements match the local SQL bodies **after removing each local trailing newline**: persistent documents `c88e8996ff5ab225430b8a2e9497048c`; lifecycle `a8d74654deba31474afe914472562104`. Both have already been applied. Do **not** run either again. Name matching alone is not body equivalence for the other 13; a release DBA must independently review their recorded SQL versus repository files and take a schema snapshot before any migration automation.

**Reconciliation strategy:** freeze migration deployment for this existing project; export and archive its `supabase_migrations.schema_migrations` version/name/body evidence, schema diff and backup; produce a reviewed 15-row equivalence manifest; test the proposed migration-history reconciliation on a disposable restored project first; use the supported Supabase CLI migration-repair workflow only after reviewing current CLI help and obtaining explicit database-owner authorization. Do not rename already-applied SQL files, replay their DDL, insert/delete migration-history rows by hand, or treat a filename mismatch as permission to run `db push`. The first genuinely new migration must have a new version later than both histories and be tested against a restored snapshot. If equivalence is not proven, deployment remains blocked pending a DBA forward plan.

The read-only comparator `node scripts/check-migration-reconciliation.mjs <remote-history.json>` checks count, names, order, versions and SQL MD5 (allowing only a final source-file newline difference). It classifies the known DOC-13 version aliases as already applied when hashes match and **fails closed** on missing checksums or unknown SQL. Prepare a restricted JSON array from a read-only SQL Editor query: `select version, name, md5(array_to_string(statements, '')) as body_md5 from supabase_migrations.schema_migrations order by version;`. Export the result as JSON, without SQL bodies or credentials, and review its project/date provenance. This is a comparison tool, **not** a migration repair/apply command. Older migrations whose recorded SQL differs from local files still need DBA equivalence review; do not override failures merely to pass the tool.

Live role metadata shows one active admin role and four active client-role rows, three with profile linkage. The unlinked active client-role row is rejected by the application's role guard, but needs a privacy-safe, authorized disposition before production. The configured master admin's active admin role exists. No candidate data or credentials were read.
The [read-only diagnostics](REL_01_OPERATIONAL_DIAGNOSTICS.md) provide count and controlled-ID queries for that orphan and other role anomalies. No live role row was changed.

## 03 — Private Storage

Read-only `storage.buckets` and `pg_policies` inspection found these exact buckets and **no `storage.objects` browser RLS policies**. Storage `objects` and `buckets` have RLS. Generic SQL table grants to `anon`/`authenticated` exist, but without object policies they do not grant browser object access. The application uses trusted server-side Storage calls and server-mediated downloads; this does not replace live negative-access testing.

| Bucket | Public? | Limit | Allowed MIME | Purpose / release state |
| --- | --- | --- | --- | --- |
| `candidate-intake-private` | No | 10 MiB | PDF, DOC, DOCX, JPEG, PNG, WebP | Source resumes and optional GCC photos; private upload/download QA still required |
| `candidate-documents-private` | No | 10 MiB | PDF only | Generated resumes, cover letters and masked copies; no public object URLs; DOC-13 live publication/download QA still required |
| `zevantaa-brand-assets` | No | 2 MiB | PNG, WebP, ICO variants | Brand settings assets, served through application-mediated route; live access QA still required |

No bucket or public policy was created or changed by REL-01. Recheck public flags/policies at deployment time, and test anonymous, other-client and entitled-client access against known fictional objects. Do not publish generated candidate PDFs to the brand bucket or a public URL.

## 04 — Authentication and identity

Code uses Supabase email/password sign-in, `@supabase/ssr` cookies with proxy claim refresh, database-backed `user_roles` (`admin`/`client` and `active`/`disabled`), and protected admin/client layouts. A disabled or unlinked client cannot pass the server role guard. Admin provisioning creates a confirmed Auth user and a one-time temporary-password response; it does not persist plaintext passwords. The manual email/WhatsApp draft links omit the password. Sign-out clears the local browser session.
The recovery request and callback now both derive redirect destinations solely from the configured `NEXT_PUBLIC_APP_URL`, not `window.location.origin`, Host or forwarding headers. Production requires a clean HTTPS origin. The callback verifies a recovery token or recovery-specific PKCE exchange before issuing a signed, HTTP-only, user-bound 15-minute proof; reset also verifies the Supabase user and consumes the proof. Login/recovery errors remain generic about account existence. Unit tests cover these properties, not live email delivery.

Production Auth dashboard checks remain open: email/password enabled; public signup and anonymous sign-in disabled; production Site URL and exact admin/client callback allowlist; reset email template with `RedirectTo`, `TokenHash`, `type=recovery`; production SMTP; provider rate limits; and live newest-link/reset/session/disabled-user QA. See [Auth configuration](AUTH_CONFIGURATION.md). The canonical HTTPS origin must be chosen before the redirects can be configured. Admin MFA is an **unverified requirement**, not a claimed active control; confirm enrollment and an enforced challenge or document a release decision. The live Supabase security advisor confirms leaked-password protection is **disabled**; enabling it and retesting password creation/reset is an explicit release gate. No Auth settings were changed here.
The app has **no MFA enrollment/challenge flow and no AAL enforcement today**. A role-only `REQUIRE_ADMIN_MFA` switch would lock out the sole admin after a password-only login with no in-app path to reach `aal2`; it was intentionally **not** added or activated. Supabase documents `auth.mfa.getAuthenticatorAssuranceLevel()` for a future authenticated `aal2` check, but enrollment/challenge and real-device recovery must be implemented and tested together before enforcement. This is an explicit manual/future-code release blocker, not a configured control. See [manual gates](REL_01_MANUAL_RELEASE_GATES.md).

## GitHub release controls

Repository metadata confirms a private GitHub repository with `main` as default and both `main` and `develop` branches present. The supplied state says `develop` is unprotected. The available GitHub connector does not expose branch-protection/ruleset reads or writes, so exact live rules for either branch are **unverified** and none were changed. Release owner must inspect **Settings → Rules → Rulesets** and **Settings → Branches** and record screenshots/export of effective rules:

- `develop`: require PR before merge, at least one non-author approval, dismiss stale approvals on new commits, require the exact successful **Quality and security** status/check for the candidate SHA, require up-to-date checks or merge queue, block force pushes and deletion, and limit bypass actors.
- `main`: same controls, stricter release-owner approval (prefer two reviewers), require exact Quality and security check and reviewed release SHA, block direct pushes, force pushes and deletion, and require signed/verified release process if approved by the owner.

Check the actual GitHub required-check context in the run UI before selecting it; workflow title alone may not be the status context. Do not claim protection is configured based on this recommendation. Avoid any required check that cannot report on the target branch without a tested workflow path.

## 06 — Release checklist (copy and complete for the actual release)

`OPEN` means this document is not evidence of completion. Record UTC time, named owner/reviewer, exact release SHA, provider project/deployment IDs and evidence links without secrets or candidate content.

| # | Gate | Status at REL-01 | Evidence required before production |
| --- | --- | --- | --- |
| 1 | CI green | Baseline reported green | Quality and security run for exact release SHA |
| 2 | Exact release SHA | Baseline identified | Signed release record and reviewed SHA |
| 3 | Production variables | OPEN | Vercel environment review + production validator pass, no values logged |
| 4 | Migrations reconciled | OPEN | 15-row equivalence manifest, restored-project trial and owner approval |
| 5 | Private Storage | Metadata checked; live QA OPEN | Bucket/policy evidence + negative access tests |
| 6 | Auth redirects | OPEN | Exact Site URL/callback allowlist and newest-link QA |
| 7 | Leaked-password protection | BLOCKED: disabled | Enable or explicit approved risk decision; retest |
| 8 | Admin MFA | OPEN | Enrollment **and** enforcement evidence |
| 9 | Branch protection | OPEN | Effective `develop`/`main` rules and required check evidence |
| 10 | Deployment | NOT STARTED | Authorized change window and immutable deployment ID |
| 11 | Smoke tests | NOT STARTED | Admin/client login, role denial, intake, downloads, errors |
| 12 | DOC-13 persistence | OPEN | Live private upload/read-back, versions, jobs and new-session downloads |
| 13 | Cross-client isolation | OPEN | Negative IDOR/Storage/score/download tests |
| 14 | Recovery/reset | OPEN | Admin/client newest, expired/reused links, new-password login |
| 15 | Headers/CSP/rate limit | OPEN | Browser CSP, response headers, provider/app rate checks |
| 16 | Mobile QA | OPEN | 390px/tablet/desktop signed screenshots and interaction checks |
| 17 | Visual PDF QA | OPEN | Output families and masked copy reviewed on real data-safe fixture |
| 18 | Restore/rollback readiness | OPEN | Timed database **and** Storage restore drill, last-good deployment |
| 19 | Final GO/NO-GO | NO-GO today | Owner/reviewer sign-off after all blocking gates close |

This checklist complements [the assurance checklist](assurance/RELEASE_CHECKLIST.md); it does not mark prior SEC/ASSUR gates complete merely because their schema migration is now present. Verify current evidence, update older dated risk documents explicitly during the release decision, and do not infer operational readiness from green CI.

Run `npm run release:verify` for the repeatable **local/CI-only** gate: local environment syntax check, secret scan, all tests, lint, build, production-dependency audit and `git diff --check`, stopping on the first failure. It does not validate production secrets, compare remote migrations, mutate providers or deploy. The migration comparator and [DOC-13/role diagnostics](REL_01_OPERATIONAL_DIAGNOSTICS.md) are separate read-only operator checks. Automated security-header tests verify HSTS/CSP/frame/referrer/permissions/COOP/CORP configuration; live browser behavior remains open.

## 07 — Rollback decision table

| Failure trigger | Immediate action | Data-preservation rule | Verify before resuming |
| --- | --- | --- | --- |
| Bad Vercel app deployment / failed protected-route smoke | Stop promotion; route traffic to last known-good immutable deployment matching the approved environment | Do not delete newly created profile, file or document records; preserve logs and deployment IDs | Auth, role denial, intake, downloads, document lifecycle and error budget |
| Bad environment value or secret rotation | Restore reviewed configuration or rotate forward through secret manager; redeploy affected `NEXT_PUBLIC_*` builds | Never restore a compromised key; keep old/new key exposure assessment and audit trail | Project/origin match, server-only key absence from bundle, Auth recovery, Storage and rate-limit behavior |
| Bad database migration | Pause writes if integrity is threatened; isolate affected operation; DBA assesses forward-fix or verified restore | No blind `DROP`, down-migration, or history rewrite; coordinate DB, Auth and Storage and assess RPO/data loss | Schema diff, constraints/RLS/grants, all post-cutover records accounted for, live smoke |
| Broken document-generation release | Disable/roll back application generation path to last-good build; reconcile pending/failed jobs | Retain last valid private PDF and version history; never overwrite/delete candidate source or ambiguous committed objects | One-current-output rule, checksum/private download, old/new session access, masked lineage |
| Broken authentication, reset or role access | Stop onboarding and access-changing operations; revert compatible app deployment or correct provider config under change control | Do not delete Auth users or role links to hide failure; preserve security audit and revoke compromised sessions where appropriate | Admin/client login, disabled-user denial, cross-role denial, newest-link reset, MFA if required |

Before any deployment, name the rollback operator, record the last-good immutable deployment/environment versions, snapshot database and Storage, and time a restore drill. A database backup alone does not restore Storage objects. Treat rollback as a new controlled operation with explicit owner and verification; no rollback was performed in REL-01.

## REL-01 decision

**NO-GO for production deployment today.** Preparation artifacts and remote read-only evidence exist, but canonical Vercel configuration, migration-history reconciliation, Auth hardening (especially leaked-password protection and MFA), branch rules, live private Storage/DOC-13 tests and a timed combined restore remain open. Green unit tests/CI cannot close these operational gates. Do not deploy or merge until a release owner records evidence and an explicit decision.
