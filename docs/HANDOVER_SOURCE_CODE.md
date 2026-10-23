# Source-code handover — preparation only

This is technical-owner orientation for the private `sofiologymkt-lab/zevantaa-resume-builder` repository, not evidence of delivery or production acceptance. The code-side release-candidate baseline for this handover is `develop` commit `50c6264670c03f2b32217cd8a9cca841537ab230` (2026-10-24). Confirm the reviewed SHA again before any release; this document does not promote it. `develop` is the integration branch and `main` is the reviewed stable baseline. Use reviewed short-lived branches and the [release gates](REL_01_MANUAL_RELEASE_GATES.md); do not assume branch protection is active.

## Map of the code

| Location | Responsibility |
| --- | --- |
| `src/app` | Next.js 16 App Router pages, protected portal layouts, server routes and download endpoints. |
| `src/features/admin-portal` | Provisioning, account edit, directory, package administration and admin document access. |
| `src/features/client-portal` | Client dashboard, read-only administrative details, private intake uploads, career editor and document library. |
| `src/features/authentication` | Supabase Auth login, recovery, logout, role checks and recovery proof. |
| `src/features/document-generation` | Source extraction and review, canonical profile mapper, ATS scoring, eight resume layouts, three cover letters, privacy masking, persistent publication and bounded regeneration. `pdf/` contains the shared PDF model, renderer, filename and download helpers. |
| `src/features/branding`, `src/components`, `src/types`, `src/lib`, `src/utils` | Brand settings, shared dashboard/UI, canonical models, Supabase/security clients and utilities. |
| `supabase/migrations` | Ordered, reviewed SQL migrations; `supabase/seed.sql` is fictional test data, not production data. |
| `tests`, `scripts` | Node 22 regression tests, cross-platform test runner, environment/secret checks, migration comparator and release verification. |
| `.github/workflows/quality-security.yml` | GitHub Quality and security workflow; no deployment step. |
| `public/branding`, `docs` | Approved application-facing assets and technical/assurance documentation. Keep original brand-kit masters untouched. |

The data path is: Supabase Auth identity → server-checked role/profile link → one canonical structured candidate profile → [document mapper](STRUCTURED_CANDIDATE_PROFILE.md) → entitled template/model → shared text-based PDF renderer → private document publication and server-mediated download. Uploaded DOC/DOCX/PDF extraction proposes content for review; it is not a second candidate-data store. See [DOC-13](DOC_13_PERSISTENT_DOCUMENT_DELIVERY.md), [package routing](PACKAGE_ROUTING.md), and [security architecture](security/SECURITY_ARCHITECTURE.md). The internal ATS score is indicative, 0–100, with a target of 90 rather than a floor or third-party guarantee.

Security controls include server-side role and account-status checks, profile-scoped service access, RLS/least-privilege database rules, private Storage buckets, bounded upload/type validation, server-mediated PDF downloads, security headers, rate limits, audit events and high-confidence secret scanning. These controls still need the live negative-access and provider checks listed in the manual gates; do not treat a green unit test as an independent security certification.

## New technical-owner setup

1. Obtain authorized repository access; clone `https://github.com/sofiologymkt-lab/zevantaa-resume-builder.git`, check out `develop`, and verify the intended SHA with `git rev-parse HEAD`. Do not copy credentials into the checkout.
2. Install Node 22 and npm; run `npm ci` using the committed lockfile. Review [dependency policy](security/DEPENDENCY_AND_SUPPLY_CHAIN.md), including the pinned Mammoth transitive override and open development-only advisory.
3. Copy `.env.example` to an ignored `.env.local` and populate only approved local/test values through the authorized secret channel. Read the [environment matrix](PRODUCTION_ENVIRONMENT_MATRIX.md). Never commit, print, or send real values in tickets. Clean CI builds need no real Supabase credentials, but protected runtime requests do.
4. Run `npm run environment:validate -- local`, `npm test`, `npm run lint`, and `npm run build`. `npm run dev` starts local Next.js after local configuration is in place. On Windows, `npm.cmd` is equivalent to `npm` in these commands.
5. Run `npm run release:verify` for the combined local/CI gate: environment syntax, secret scan, complete tests, lint, build, production dependency audit and `git diff --check`. This does **not** validate provider settings or authorize deployment. Run production environment validation only in the approved target environment without exposing values.

Use [CI gate details](assurance/CI_CD_SECURITY_GATES.md) for the GitHub workflow and SBOM artifact. The release owner must review the full dependency audit separately; a zero production audit does not clear the tracked development-only findings. Tests and local build do not replace live Auth, private Storage, migration, device, PDF, or restore checks in the [manual gate register](REL_01_MANUAL_RELEASE_GATES.md).
