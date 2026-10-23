# QAT-01 functional QA evidence

Date: 2026-10-13. Branch: `develop`. Workspace: `C:\Development\zevantaa-resume-builder`.

This is a local/pre-deployment functional pass, not a claim that the release or deployment-only SEC-01/ASSUR-01 gates are complete. The suite uses fictional fixtures and isolated Supabase test doubles; it cannot replace a signed-in browser exercise against disposable QA accounts and private Storage.

## Automated and local HTTP evidence

| Task | Evidence in this pass | Remaining live verification |
| --- | --- | --- |
| QAT-01-01 Admin login | `fnd-05-07`, `password-recovery`: generic invalid/unknown-email errors, logout, authoritative role/status denial, protected route guards. Built-app `/login?portal=admin` returned 200; anonymous `/admin` and `/admin/clients/new` returned 307 to admin login. | Valid admin login, refresh/session persistence, logout and disabled-account behavior in a real browser. |
| QAT-01-02 Client login | `fnd-05-07`, intake ownership tests: role/status and linked-profile isolation; built-app `/login?portal=client` returned 200; anonymous `/client`, `/client/profile`, `/client/documents` returned 307 to client login. | Valid client login, refresh/logout, wrong-role and disabled-client behavior against real Auth/DB. |
| QAT-01-03 Account creation | `fnd-05-07`: existing/new candidate, generated credentials, confirmed Auth user, role/linkage, duplicate email/profile, invalid package/status, rollback and admin guard. | Create disposable clients in Supabase and verify Auth/role/profile rows and welcome flow. |
| QAT-01-04 Package assignment | `dsh-01-package-routing`: exact seven-package/eleven-output entitlement matrix, unknown/retired values fail closed; `fnd-05-07` package edits survive a fresh service reload. | Verify each package's actual portal output list and package edits after browser reload. |
| QAT-01-05 Profile save | `fnd-05-07` covers admin-owned fields on provisioning; canonical validators and profile mapper have separate regression coverage. | Save all core fields and target markets through admin UI, then reload from live database. |
| QAT-01-06 Profile update | `fnd-05-07`: email/package/status edits, duplicate rejection, rollback and preserved linkage; intake tests reject client mutation of admin-owned fields. | Browser edit, disable/reactivate and client read-only check against real linked accounts. |
| QAT-01-07 DOC upload | `fnd-06-08-10`: OLE signature, MIME/extension, 10 MB limit, deceptive names, replacement/version and ownership; `doc-02-extraction` extracts a synthetic real OLE DOC. | Upload and replace a private DOC in a disposable client account. |
| QAT-01-08 DOCX upload | `fnd-06-08-10`: ZIP structure, missing essential OOXML members, malformed directory, MIME and size; `doc-02-extraction` checks paragraphs/tables and corrupt/macro-bearing files; dependency regression checks Mammoth with the pinned `argparse` override. | Upload a real DOCX and verify private Storage and extraction preview. |
| QAT-01-09 PDF upload | `fnd-06-08-10`: signature, EOF/startxref presence and bounded numeric offset, MIME, size, replacement; `doc-02-extraction` checks text/multi-page/image-only/encrypted/corrupt outcomes. | Upload/replace a real text PDF and a scanned PDF; open the original privately. |
| QAT-01-10 Photograph upload | `fnd-06-08-10`: JPEG/PNG/WebP signatures, corrupt/truncated input, decoded dimensions and pixel count, MIME, 5 MB limit, GCC-only behavior and replacement; GCC PDF tests decode all three formats. | Upload and replace a real GCC photo; inspect crop and private access. |
| QAT-01-11 Resume downloads | Global ATS, Domestic 1–5, GCC and European PDF suites verify generated/searchable A4 text, content, page geometry and protected route behavior; package-routing suite checks entitlement. | Exercise every entitled production download in a signed-in browser, inspect filenames/headers, open PDFs and verify current live profile facts. |
| QAT-01-12 Cover letters | `doc-12-cover-letters` verifies three entitled variants, deterministic reviewed facts, one-page searchable PDFs and guarded production route. | Download all three from a disposable Executive account and inspect prose/facts. |
| QAT-01-13 Privacy-masked export | `dsh-04-privacy-masked-export`: private admin route, reference filename, retained name/career content, masked direct contacts, routing, searchable single/multi-page PDFs and original unchanged. | Admin download against a disposable profile and inspect all pages plus unchanged normal resume. |

DSH-06/07 career editor, repeated sections, stale-tab revision, skill normalization, optional education, certifications/projects, ATS and fresh-document propagation are covered by `dsh-06-*` and `dsh-07-v8` regression tests. They still need a signed-in browser round trip with live persistence.

## Checks and findings

- `npm.cmd test`: 314 passed, 0 failed; three new upload edge-case tests were added. Existing login test was strengthened for unknown email and admin intent.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd audit --omit=dev`: 0 known production dependency vulnerabilities.
- `npm.cmd run security:secrets`: no configured high-confidence patterns found in versioned or new non-ignored text files.
- Built-app anonymous HTTP smoke on local port 3101: both login pages 200; five protected routes redirected 307 to the correct portal login. This does not demonstrate authenticated session persistence.
- Upload defect found and fixed: an out-of-range PDF `startxref` offset could pass the initial signature check. Validation now requires a bounded numeric offset in the final trailer. This is deliberately a lightweight upload check; full PDF parse validity remains the extractor's responsibility.

No live Auth users, profile rows, Storage objects, or remote settings were created or changed. No credentials or private file contents were logged. QAT-01 is **not fully closed** until the live browser scenarios above are executed and recorded. Deployment-only SEC-01/ASSUR-01 gates remain separate release blockers; this local functional pass does not close them.

## QAT-01-14 — ATS score display (2026-10-13 follow-up)

Targeted score, career-save, document-propagation, v8 editor, and active-row tests verify the fixed 90 benchmark, deterministic 0–100 bounded breakdown, no forced 90 floor, not-ready state for insufficient facts or an unknown package, nullable optional data, no-skills/empty-summary and many-skills cases. The score display source shows the numeric `/100`, target, internal/indicative disclaimer, breakdown and not-ready state on the client overview, client ATS view and authorized admin per-client Global ATS page. Source and service tests verify that the client score resolves only the authenticated linked profile, does not take a browser profile ID, and excludes archived career rows.

A regression exposed duplicate normalized skills inflating skills coverage: eight aliases of Microsoft Excel earned 15/15 instead of the single-skill 5/15. The score now counts distinct normalized skill keys using the existing career-editor normalization rule. No weights, benchmark, band thresholds, or stored data were changed.

A mocked canonical-data round trip confirms that merely opening/changing an unsaved draft and a rejected stale save leave the server score unchanged; an accepted save followed by a new service load recalculates it. Live Auth/DB/browser checks remain: signed-in client ownership, admin access, a successful career edit and score refresh in both views, stale-tab rejection, and package changes. The test doubles are evidence of application logic, not proof of remote RLS or deployed-session behavior.

Follow-up checks: 30/30 targeted ATS/DSH-06/07 tests, 319/319 full tests, lint and production build passed. Production-only npm audit found 0 vulnerabilities; the secret scan found no configured high-confidence patterns. On the locally built app, signed-out `/client/ats` and `/client` returned 307 to client login, while the admin per-client Global ATS route returned 307 to admin login. These HTTP checks do not prove signed-in role isolation.
