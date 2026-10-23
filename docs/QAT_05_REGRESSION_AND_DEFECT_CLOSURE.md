# QAT-05 — Regression and defect closure

Date: 2026-10-13. Branch: `develop`. This is local, pre-deployment evidence using fictional fixtures and isolated Auth/Storage doubles. It preserves all uncommitted QAT-01–04 work. No remote Supabase state, candidate data, migration, commit, or push was changed.

## Defect retest register

QAT-01 and QAT-03 did not assign formal severities or IDs to every finding. The IDs and triage severities below make those findings traceable for this closure pass; they do not retroactively claim a live exploit or browser reproduction. “Automated closed” means the prior local reproduction/contract and adjacent regressions pass. It does not close the separate live checks below.

| ID | Found | Severity | Original defect/reproduction | Minimal fix | Retest and adjacent evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| QAT01-001 | QAT-01 | Medium | A PDF bearing a syntactically present but out-of-range `startxref` offset passed the lightweight upload signature gate. It did not prove successful PDF parsing. | Require a bounded, safe-integer offset in the final trailer. | `fnd-06-08-10` rejects malformed/out-of-range trailers and retains valid PDF, DOC/DOCX, size, ownership, and replacement cases. | Automated closed; real-file upload pending. |
| QAT01-002 | QAT-01-14 | Medium | Eight normalized aliases of one skill could earn 15/15 ATS skill points instead of 5/15. | Count distinct keys from the existing skill normalizer without changing weights or the 90 target. | `doc-04-05-06` and `qat-01-14-ats-active-rows` cover duplicate aliases, low scores, fixed benchmark, canonical reload, and archived rows. | Automated closed; live score refresh pending. |
| QAT02-001 | QAT-02 | Low | An `https:` annotation could target localhost or a private/internal host, though the renderer did not fetch it. | Reuse the approved external-URL validator and reject control characters in link targets. | `qat-02-document-links` parses PDF annotations; `dsh-04-privacy-masked-export` verifies no private contact annotation; safe HTTPS remains active. | Automated closed; signed-in PDF inspection pending. |
| QAT03-001 | QAT-03 | Medium | The login grid used an unshrinkable intrinsic track that could expand a narrow viewport. | Give the page and shell shrinkable grid widths. | `qat-03-responsive` source contract and the seven-width Chrome login probe pass, including 320px. | Automated closed; physical-device/zoom review pending. |
| QAT03-002 | QAT-03 | Medium | Directory filters retained four minimum-width columns from 48rem, too wide for tablet. | Use two columns until 64rem; keep table overflow local. | `qat-03-responsive` verifies breakpoints and local table scroll; protected populated-directory browser inspection remains unavailable. | Source regression passed; authenticated visual QA pending. |
| QAT03-003 | QAT-03 | Medium | Long career entry titles and skill chips could enlarge narrow layout tracks. | Permit wrapping and constrain intrinsic width. | `qat-03-responsive` verifies the selectors and high-volume fictional career draft. | Source regression passed; authenticated visual QA pending. |
| QAT03-004 | QAT-03 | Medium | Skill-result grid minimum tracks could exceed a narrow container. | Cap minimum track width to the available container. | `qat-03-responsive` source contract passes. | Source regression passed; authenticated visual QA pending. |
| QAT03-005 | QAT-03 | Medium | Native resume/photo/brand file controls could extend beyond narrow form columns. | Constrain file-input width and minimum width. | `qat-03-responsive` and upload-service regressions pass. | Source regression passed; mobile picker QA pending. |
| QAT04-001 | QAT-04 | High | Automatic PDF hyphenation inserted characters into copied/searched candidate names and roles, such as `Opera- tions`. | Disable automatic hyphenation; wrap very long displayed HTTPS contact text explicitly without changing its link target. | `qat-04-document-qa` extracts A/B/C/D facts from all outputs; `doc-03-01-04` retains long-URL A4 geometry; link and privacy suites pass. | Automated closed; human page inspection pending. |
| QAT04-002 | QAT-04 | Medium | Canonical mapping could emit both `MS Excel` and `Microsoft Excel` as duplicate output skills. | Keep the first ordered supplied wording per normalized key and emit a warning for later aliases. | `qat-04-document-qa` checks mapper and rendered ATS output; ATS score and template suites pass. | Automated closed; live reviewed-data sample pending. |

No QAT-01–04 evidence records a confirmed **Critical** defect. Accordingly, none was invented for this pass. The critical-risk boundaries were nevertheless rerun: role/status gates, cross-client and forged-ID denial, private file ownership, admin-only generation, masked-export isolation, password recovery, safe PDF links, and no browser service-key exposure. Test doubles and source checks do not prove the remote RLS or Storage policy state.

## Regression coverage and code-quality review

- **Documents:** the QAT-04 A/B/C/D fixture matrix exercises Global ATS, Domestic 1–5, GCC, European and three cover letters. It validates real PDF signatures, extractable reviewed facts, section omission, ordering, page count and bounds, long text, GCC photo conditionality, filenames, package routing, normalized skills, privacy text/annotations/metadata and original-vs-masked separation. Existing DOC-03/04/05/10/11/12 and download-route tests provide adjacent coverage.
- **Access:** FND-05/06, DOC-02 ownership, DSH-02/03/04/06, QAT-02 and SEC/ASSUR regressions cover anonymous/wrong-role denial, client profile resolution, forged identifiers, locked admin fields, private bucket/file ownership, safe links and fail-closed rate limits. Credentialed cross-account browser testing remains outstanding.
- **Responsive:** the seven-width local Chrome probe checks `/login` at 1440×900, 1365×768, 1024×768, 768×1024, 390×844, 360×800 and 320×700. Source/data tests cover tablet directory filters, locally scrollable tables, narrow file controls, skill results/chips, career titles and high-volume draft content. Protected authenticated screens were not visually inspected.
- **Combined uncommitted diff:** reviewed production changes for conflicting validation, debug code, test-only hooks, broad CSS selectors and inconsistent error handling. Existing skill normalization is reused by both ATS scoring and the document mapper. The PDF external-URL guard remains independent of URL display wrapping. Test resolver hooks stay in test files. One misleading renderer comment was corrected; no broad refactor or new feature was needed.

## Remaining manual/live evidence gaps

1. Credentialed admin/client login, session refresh, password recovery, logout and Back-button behavior, including disabled and wrong-role accounts.
2. Live provisioning and admin-owned profile/package round trip; client read-only behavior; a saved career edit followed by ATS and PDF refresh.
3. Direct private Storage and signed-in document/photo/resume download checks using two disposable clients; forged profile/file/document IDs and cross-client browser substitution.
4. Authenticated desktop/tablet/mobile dashboard, directory, editor, forms, upload controls, calendar and table interactions; physical mobile file picker/PDF opening and zoom/focus checks.
5. Human visual review of all generated PDF pages, GCC photo crop, cover-letter prose, pagination balance, clickable links and the separate masked PDF.
6. Deployment-only SEC/ASSUR live gates remain deferred and are not represented as passed here.

These are open QA evidence gaps, not newly confirmed application defects. QAT-05 may be **GO WITH MANUAL QA PENDING** for local regression closure if the final command matrix below passes; this is not a production-release GO.

## Final command matrix

| Check | Result |
| --- | --- |
| Targeted defect/security/document/responsive tests | **84/84 passed** across nine focused test files. |
| Full regression `npm.cmd test` | **343/343 passed**. |
| Standalone QAT-04 document suite | **17/17 passed**. |
| Local Chrome responsive probe | **7/7 passed** on the public login route, 1440px through 320px; no page-level overflow. |
| Built-app anonymous access smoke | `/admin` and admin Global ATS page → 307 admin login; `/client` and `/client/ats` → 307 client login. No signed-in role claim. |
| `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed. |
| `npm.cmd audit --omit=dev` | Zero known production-dependency vulnerabilities. |
| `npm.cmd run security:secrets` | Passed; no configured high-confidence pattern found. |
| `git diff --check` | Passed; Git emitted line-ending conversion notices only. |

No new functional regression or confirmed unresolved software defect was found in this pass. One comment in the shared PDF renderer was corrected to describe where long URL display wrapping actually occurs; behavior did not change. Overall QAT-05 recommendation: **GO WITH MANUAL QA PENDING** for local regression closure, not production release authorization.
