# Deployment configuration handover — not a deployment instruction or approval

No production deployment or provider setting is attested by this page. The exact variable inventory and verification status are in the [production environment matrix](PRODUCTION_ENVIRONMENT_MATRIX.md); the values belong in an approved secret manager/Vercel environment, never in Git or this document.

| Name | Intended exposure | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public/browser | Approved canonical HTTPS origin; required for recovery and welcome links. Rebuild after change. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public/browser | URL for the approved Supabase project; verify project ownership and environment match. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public/browser | Preferred browser key. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/browser | Legacy fallback only if preferred key is absent. |
| `SUPABASE_SECRET_KEY` | Server-only secret | Preferred trusted admin/Storage key; never use a `NEXT_PUBLIC_` prefix. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Legacy fallback only if preferred secret is absent. |
| `SECURITY_RATE_LIMIT_KEY` | Server-only secret | Independent 32+ character key for rate-limit subjects. |
| `NODE_ENV` | Framework setting | Set by Next.js/hosting; not an authorization role. |
| `DEPLOYMENT_ENV` | Validation selector | Optional for `environment:validate`; explicit `production` argument is also supported. |

Vercel is the intended Next.js host, but its production project, domain, variable values and access have **not** been verified. Public `NEXT_PUBLIC_*` values are embedded at build time; server-only values must stay off browser bundles. Protected portal routes render dynamically and require valid Supabase configuration when requested. A clean CI build with no provider secrets is intentional, not proof that runtime configuration works. Before an authorized promotion, validate the approved target with `npm run environment:validate -- production`, then check actual Auth, Storage and role behavior. No fake credentials or preview origin should substitute for production configuration.

Supabase supplies Auth, PostgreSQL and private Storage. Confirm the approved production project separately; the project examined during REL-01 is not automatically the chosen production tenant. The private buckets are `candidate-intake-private` (source resumes/GCC photos), `candidate-documents-private` (generated PDFs), and `zevantaa-brand-assets` (brand settings). Private flags, policies, object access and bytes require live negative-access/read-back QA. Do not issue public object URLs. Auth requires an approved Site URL and exact HTTPS allowlist entries `<origin>/auth/callback?portal=admin` and `<origin>/auth/callback?portal=client`, plus a tested recovery email template and production SMTP. See [Auth configuration](AUTH_CONFIGURATION.md); all provider checks remain [OPEN](REL_01_MANUAL_RELEASE_GATES.md).

## Migration control

Treat `supabase/migrations` as reviewed source, not an automatic replay list for the existing remote project. REL-01 observed 15 migrations whose remote history versions often differ from repository filename timestamps. The DOC-13 files `20261019064514_doc_13_persistent_documents.sql` and `20261019064608_doc_13_document_lifecycle.sql` were recorded remotely under `20261023190731` and `20261023190738`; their SQL bodies matched apart from a final newline. They are **already applied** and must not be applied again. Other filename/body equivalence still needs a restricted 15-row manifest and DBA review. Follow [REL-01 reconciliation procedure](REL_01_PRODUCTION_PREPARATION.md) and the read-only `scripts/check-migration-reconciliation.mjs` comparator. Freeze migration deployment until approved; test any migration-history repair on a disposable restored project, never edit history or replay DDL to make filenames match.

`npm run release:verify` is the local automated gate only. A release owner must separately close the [manual/provider gates](REL_01_MANUAL_RELEASE_GATES.md), confirm the exact SHA/CI run, and approve deployment. For rollback, retain the last known-good immutable deployment and matching environment; stop promotion, assess DB compatibility, and use an approved forward repair or verified restore—not an unreviewed down-migration. Database backup alone does not restore Storage bytes or Auth/provider settings. See [rollback procedure](assurance/ROLLBACK_PROCEDURE.md) and [disaster recovery plan](assurance/DISASTER_RECOVERY_PLAN.md). No combined restore drill is evidenced.
