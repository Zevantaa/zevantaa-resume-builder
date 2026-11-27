# Remaining ATS feature completion and release status

Snapshot: 28 November 2026, feature branch `feature/master-template-fidelity` based on `origin/develop` commit `1281f65`. This is a **development audit and a focused PDF clipping fix**, not a production release acceptance. `origin/main` was `4eb28ae` at the start of the audit. No production SQL, migration, Auth setting, credential, Storage object, Cron job or Vercel deployment was changed.

## Already present in the baseline

- Seven frozen packages and 11 output IDs (eight resumes, three letters) with shared entitlement routing; Executive All-Inclusive is the only package entitled to all 11.
- Admin-created client accounts, authentication, private intake and document storage, protected downloads, versioned document rows, a client edit/review/confirmation path, and monitoring/admin support paths.
- Automated source processing, lease/retry-based document jobs and an authenticated internal worker route. The current readiness path requires explicit client confirmation and does not require ordinary administrator approval. Replacement-resume handling requests client review rather than silently appending conflicting facts.
- Source-linked original/generated indicative ATS assessment code and a Before/After comparison view. The score is an internal calculated measure, not a third-party ATS guarantee.
- React PDF generators with canonical `DocumentData` mapping, long-history flow and local fictional QA fixtures. Existing premium UI and earlier performance improvements are present in the baseline; this audit did not rerun live browser performance measurements.

These are **source-code observations**, not proof that corresponding migrations, credentials, scheduler or jobs are active in production.

## Implemented in this branch

1. Physically reconciled the 20 supplied master assets and added `scripts/audit-master-template-references.mjs` for repeatable filename, SHA-256, PDF-page and selectable-text inspection.
2. Added `MASTER_TEMPLATE_INVENTORY.md`, `MISSING_MASTER_TEMPLATES.md` and `TEMPLATE_VISUAL_FIDELITY_REPORT.md` with output-by-output evidence and explicit approval limits.
3. Expanded the page PNG QA report to flag pages with under 35% vertical text occupancy and count text items beyond physical page bounds.
4. Fixed a confirmed long LinkedIn URL that clipped the Technology & Startup letter; added a focused PDF-boundary regression test. This preserves the existing category template and candidate facts.
5. Added validated A4/US Letter rendering support in the shared PDF theme. A4 remains the default; regional intake does not yet select Letter automatically.
6. Updated pinned `next` and `eslint-config-next` to 16.4.6 after the production audit identified a moderate Next.js advisory. Applied npm's nonbreaking transitive lockfile fixes for development-only `minimatch` and `zod` advisories. No new paid service or runtime integration was introduced.

## Missing or incomplete

| Area | Current gap | Safe next implementation |
| --- | --- | --- |
| Exact master fidelity | Runtime React PDF layouts are adaptations, with no same-data HTML/PDF comparator, template version metadata or approved font equivalence | Build a controlled comparison fixture and measured tolerance gates; resolve font licensing and renderer choice; iterate each V1 design |
| Visual pagination | Sparse trailing pages in Domestic 1, 3, 4, 5 edge/normal fixtures; bounds scan does not detect interior overlaps | Inspect and improve specific section grouping without dropping facts; add location-aware visual assertions |
| Global ATS markets | Canonical target markets remain broad `indian-domestic`, `gcc-middle-east`, `european-union`; no USA/Canada/UK/Australia/Global MNC choice, JD input, keyword provenance or Letter routing | Specify and add conditional intake, validated schema, scoring version and renderer page-size option with tests |
| GCC | Nationality, visa/work status, notice, driving licence, marital/mobilization details are not canonical fields; reference meta-grid is absent | Add consent-aware, optional verified fields and conditional output; never infer from relocation preference |
| Europass/EU | No EU/EEA work-rights field, mother tongue, validated EQF or five-axis CEFR; reference wordmark policy unresolved | Add client-confirmed values and validation, then conditional table/qualification blocks |
| Germany | No approved master, separate output ID or package entitlement; November 14–15 specifications not present in documented local references | Decide adaptation versus new family/package before routing; develop neutral validation components only after scope is fixed |
| Letters | Target company/recipient/date and regional facts are absent, so master prose and blocks cannot be reproduced factually | Add verified optional target facts, omit empty blocks, retain source-path provenance |
| Client preview | There is no shared HTML/CSS renderer providing proven identical dashboard preview and PDF | Choose tested shared definition or explicitly document differing preview semantics |
| Live automation/ATS | No authenticated read of current queue, snapshots, Cron, Vault or worker result in this run | Verify project access, backups and migrations; inspect counts without reading candidate contents, then run fictional authenticated smoke tests |

## Product decisions needed

- Technology & Startup: supply the final HTML/PDF pair and approval/version record. Until then its existing letter remains the safe V1 output.
- Germany Lebenslauf and DIN 5008 Anschreiben: decide whether either adapts an existing entitled slot or changes the frozen 11-output product. The same decision is needed for a standalone GCC mobilization or EU motivation letter. No extra output was added.
- Regional intake: approve mandatory versus optional fields, privacy/retention treatment for nationality, marital/visa data and photographs, and when US Letter is required.
- Europass wordmark and official-endorsement language: approve allowed use before reproducing the reference badge.

## Database and production gate

The local repository contains 24 forward migrations. The latest two are `20261113052443_complete_client_experience_admin_ats.sql` and `20261113124500_client_confirmation_release_fixes.sql`; their **live** status was not established. The connected Supabase tool rejected a read-only `get_project` for `fzltowzpfrnuxxxrzuih` with a permission error, and no Supabase CLI was on this shell's PATH. Earlier release reports are historical, not a current production attestation. No migration was created or applied for this audit.

Scheduler and queue status: **unknown live**. No worker URL, Vault token or queue count was read; no Cron activation was attempted. Deployment status for this branch: **not deployed**. Before any release, recover verified project access, confirm an encrypted recoverable database and private-Storage backup, reconcile migration history and current schema, test Auth/SMTP/worker configuration, and complete the visual/data gates. Then follow the existing approved feature → `develop` → `main` → Vercel workflow with explicit approval at irreversible production steps.

## Validation evidence

- Asset audit: 10/11 pairs, no unexpected files, no duplicate hashes, all 10 supplied PDFs with text on each page.
- Generated 44 fictional PDFs and page PNGs for short, normal, extensive and edge profiles. No text beyond page edges after the URL fix. Several sparse pages remain flagged; exact master fidelity remains unverified.
- Focused Technology URL PDF test and explicit Letter-size PDF test passed. Full suite: **435/435 passed**. ESLint, `tsc --noEmit`, production `next build`, secret scan and full `npm audit` all passed; the final audit reported **0 vulnerabilities**. The first restricted build could not fetch the configured Google fonts, but the final build passed with authorized network access. No responsive browser run or authenticated production test was performed in this branch.
