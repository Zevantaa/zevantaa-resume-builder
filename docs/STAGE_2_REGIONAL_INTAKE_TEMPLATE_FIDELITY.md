# Stage 2 regional intake and template fidelity

Development snapshot: 28 November 2026, `feature/master-template-fidelity`, starting at `1c3392312b7fbd597441555a2f9f42f0989e3ca6`. The eleven frozen output IDs and seven package entitlements remain unchanged. **Production release: blocked; no migration or deployment was executed.**

## Implemented

- Added one authenticated client questionnaire for Global ATS target market (India, Global MNC, USA, Canada, UK, Australia), target title and job description, keywords, confirmed functional/technical skills, notice period and work authorization. GCC and European panels appear only for entitled packages. A linked active client saves a validated, revision-checked snapshot; stale edits fail. Regional edits advance the existing `career_revision`, so the existing document lifecycle trigger invalidates stale versions and enqueues entitled outputs. No new queue, account role or package was added.
- Added deterministic `jd-keyword-v1` compatibility scoring. It compares explicitly supplied keywords, or the top 20 non-stopword job-description terms, with confirmed profile text and skills. The UI displays matched and missing terms, source, version and an indicative-score disclaimer. The ATS page reuses one trusted profile read for both indicators. This is separate from the existing document-linked Before/After ATS assessments; it never substitutes for an absent assessment or promises ATS acceptance.
- Global ATS routes USA and Canada to US Letter, all other markets to A4. Confirmed target role is labelled as a target. Verified availability is conditional. For Letter output, languages are grouped with skills to avoid a stranded final page; other markets retain the existing language section. Dates still use existing explicit-month formatting.
- GCC renders candidate-confirmed nationality, visa/work status, notice, licence and optional personal detail in a conditional grid. The private uploaded image is fetched for a generated GCC document only with explicit, persisted client consent; revocation advances the profile revision. Unknown visa or relocation status is omitted.
- European output renders mother tongue, client-confirmed EU/EEA work authorization, five CEFR axes in a readable grid, and an EQF level only when the submitted education ID belongs to the current active profile and a verification source is supplied. No EQF level or CEFR value is inferred from general education/language entries.
- Added `stage2-regional-2026-11-28.1` PDF subject metadata to newly persisted outputs. This identifies the implementation version, **not** a master-reference approval. Existing document version rows, private storage, atomic publication, auth and RLS paths were retained.
- Added `scripts/compare-template-same-data.mjs`: requires a named fictional fixture, both PDFs and at least three required candidate facts present in each; emits page PNGs, page counts, dimensions, text bounds, font identifiers and per-page pixel difference. It fails if the fact precondition or text-boundary check fails. A same-file fictional smoke test passes and a missing-fact input fails. The supplied static masters and app fixtures currently contain *different* fictional candidates, so no master-to-app similarity claim is made.
- Fixed PDF opening grouping for short entries and first heading/description blocks, preventing a project bullet from detaching and keeping certification headings with their first fact. Regional spacing was tightened without lowering body text below 10 pt. The Stage 1 reference audit remains 10 matching named HTML/PDF pairs, 0 duplicates and 0 unexpected files.

## Migration and compatibility gate

New forward-only migration: `supabase/migrations/20261127203902_regional_intake_v1.sql`, ordered after the 24 existing local migrations. It adds only `candidate_profiles.regional_intake` (JSONB default `{}`), `regional_intake_confirmed_at`, `gcc_photo_consent_at`, a size/shape constraint, and a service-role-only RPC. Existing rows receive `{}`; no Auth users, `user_roles`, source files, document rows, Storage objects, packages or admin accounts are updated or deleted by this SQL. The RPC checks active client linkage, locks the profile and checks the expected career revision. It explicitly updates `career_revision` when facts change so the existing `AFTER UPDATE OF career_revision` document trigger fires. Client browser roles get no RPC EXECUTE grant. Existing table RLS and grants are not weakened.

**Before production:** verify the live schema has `career_revision`, `user_roles.candidate_profile_id`, `user_roles.account_status`, the `candidate_profiles_invalidate_generated_documents` trigger, `document_regeneration_jobs`, and the current document lifecycle functions; reconcile the manually applied historical migrations without replay; verify a recoverable database and private Storage backup and isolated restore; apply this migration; check existing admin/client counts and file/document counts before and after; then deploy dependent application code. Rollback is a code rollback plus forward repair of this additive schema, with database restore only under the established recovery procedure. Never reset production or drop the new columns while new code may be serving.

Live preflight is **blocked**: the connected Supabase tools return `You do not have permission to perform this action` for project `fzltowzpfrnuxxxrzuih`. An official read-only CLI `projects list` showed only Nucelus projects, not Zevantaa. The local PostgreSQL service requires credentials and Docker CLI is unavailable in this workspace, so an isolated SQL rehearsal was not completed. No live migration compatibility or existing-account preservation check is claimed.

## Visual QA

Generated all 11 fictional PDFs for short, normal, extensive and edge profiles (44 documents; 96 pages), then rendered **every page** to PNG at 2×. Reports/images are ignored local artifacts under `output/pdf/stage2-pages/{short,normal,extensive,edge}`. The edge fixture covers long names, URLs, titles and dense lists. The bounds scan found zero text items outside all 96 pages. Representative Global ATS, GCC and European pages were inspected visually after the final render; no overlap was observed on those pages. Automated bounds cannot prove absence of interior overlap on every page.

| Output | Pages short / normal / extensive / edge | Stage 2 outcome |
| --- | --- | --- |
| Global ATS | 1 / 2 / 5 / 3 | USA/Canada Letter, other markets A4; orphan short page removed |
| Domestic 1 | 1 / 2 / 5 / 3 | Short project kept together; edge last-page occupancy 0.347 |
| Domestic 2 | 1 / 2 / 5 / 3 | Existing bounded sidebar adaptation retained |
| Domestic 3 | 1 / 2 / 5 / 3 | Short project kept together; extensive/edge last pages 0.348 |
| Domestic 4 | 1 / 2 / 4 / 2 | Normal second page occupancy 0.326; needs design review |
| Domestic 5 | 1 / 2 / 5 / 3 | Short project kept together; no sub-0.35 edge page |
| GCC | 1 / 2 / 5 / 2 | Conditional verified grid and private consent-gated image; short trailing page removed |
| European | 1 / 2 / 5 / 2 | Five-axis CEFR grid and sourced EQF; short and edge trailing pages removed |
| General Corporate letter | 1 / 1 / 1 / 1 | Existing fact-safe design retained |
| International Relocation letter | 1 / 1 / 1 / 1 | Existing fact-safe design retained; no unverified visa claim |
| Technology & Startup letter | 1 / 1 / 1 / 1 | Existing design retained; approved master pair absent |

The 35% trailing-page threshold is diagnostic, not a fact-loss or page-count mandate. Domestic 1/3 edge and Domestic 3 extensive are just below it after grouping; Domestic 4 normal remains 0.326. They need page-by-page reviewer sign-off. All existing career facts remain in the PDFs. Exact font, header geometry and pixel fidelity are **not approved**: the masters use fonts whose licensing/embedding choice is unresolved, and there is no genuinely same-data master/app pair. The current European wordmark treatment also needs a brand/legal decision. Do not present the comparator smoke test as a master comparison.

## Validation and release status

- Full regression suite: **445 passed, 0 failed** after the PDF grouping change.
- ESLint: passed with no warnings. TypeScript `tsc --noEmit`: passed. Production Next.js build: passed, including `/client/regional-intake`.
- Secret scan: passed. Full `npm audit` and production-only audit: **0 vulnerabilities** each after running with registry access.
- Same-data comparator positive/negative tests: passed. Stage 2 PDF text/bounds regression tests: passed.
- Migration was **not applied**, Git branches were **not merged**, Vercel was **not deployed**, Cron was **not changed**. Production cannot use the new code until the migration and safety gates pass.

## Remaining product decisions and exact missing assets

1. Supply the final **Technology & Startup cover-letter master HTML and matching PDF**, plus approval/version and licensed font/assets record. Their exact filenames were never specified; do not invent them.
2. Approve fonts and tolerances for true same-data master/app visual comparison. The current source PDFs' fictional candidate facts differ from application QA fixtures; create controlled reference renders from a single fictional structured profile before assigning similarity scores.
3. Decide the permitted Europass wordmark/endorsement treatment and whether candidate-supplied EQF classification needs independent evidence before publication.
4. Decide Germany Lebenslauf/DIN 5008 output family and package entitlement separately. No German output was added.
5. Review remaining domestic sparse-page cases and final letter target-company/recipient/date requirements; no unsupported claims or layouts were inserted.

The immediate release blocker is access to the **Zevantaa** Supabase project from this workspace. An authorized Zevantaa operator must connect the correct Supabase account/project before live preflight, backup verification, migration and deployment can proceed.
