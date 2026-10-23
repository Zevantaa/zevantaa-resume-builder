# QAT-04 — Document QA

Date: 2026-10-13. Branch: `develop`. QAT-01/02/03 uncommitted work remains in place. This pass uses fictional, deterministic canonical profiles only; no candidate record, storage object, or database migration was changed.

## Fixtures and method

- **A — complete:** reviewed summary, 5 ordered roles (including a current role), achievements, 2 education entries, 20 skills, certifications, languages, project, additional section, LinkedIn, relocation, and all-output package context.
- **B — sparse:** required identity/contact and one skill; no optional summary, role, education, certifications, projects, languages, LinkedIn, WhatsApp, or GCC photograph.
- **C — stress:** long names/employers/highlights, 8 roles, 3 education entries, 24 skills, 4 certifications, 3 projects, languages, and additional section.
- **D — special characters:** apostrophe, hyphen, accented Latin name, ampersand in employer, and accented place name, without adding unsupported facts.
- All eight resume models are built from the canonical mapper, rendered to real A4 PDF bytes, and parsed with PDF.js. Checks cover the PDF signature, extractable fixture facts, page count, page bounds, same-line text collisions, blank pages, empty-section omission, obvious developer artifacts, and the experience heading/first-role page relationship. GCC is additionally rendered with and without a programmatic fictional portrait. All three letters are rendered from A and D. The masked ATS PDF is inspected separately.
- These checks are structural and text-based. They do **not** establish visual polish, font appearance, balance of whitespace, or recruiter readability without human page inspection. PDF.js emits a `standardFontDataUrl` warning in this test environment; extraction and assertions still complete.

| Output | A complete | B sparse | C stress | D special | Automated result |
| --- | ---: | ---: | ---: | ---: | --- |
| Global ATS | 4 | 1 | 7 | 4 | Pass: canonical text, single-column model, section order, omission, page bounds, searchable name/role. |
| Domestic 1 — Executive Classic | 4 | 1 | 7 | 4 | Pass: ruled-section design remains distinct; text and bounds pass. |
| Domestic 2 — Modern Professional | 4 | 1 | 7 | 4 | Pass: identity-band design remains distinct; heading and first role share a page. |
| Domestic 3 — Compact High-Density | 3 | 1 | 5 | 3 | Pass: uppercase/compact design remains distinct; text and bounds pass. |
| Domestic 4 — Contemporary Sidebar | 3 | 1 | 5 | 3 | Pass: first-page two-zone design remains distinct; text and bounds pass. |
| Domestic 5 — Premium Minimal | 4 | 1 | 8 | 4 | Pass: spacious design remains distinct; text and bounds pass. |
| GCC | 3 | 1 | 6 | 3 | Pass: regional identity, optional photograph/no-photograph, text and bounds. |
| European / Europass-style | 3 | 1 | 6 | 3 | Pass: regional section names, explicit language proficiency only, text and bounds. |
| General Corporate letter | 1 | Not ready by design | Not separately rendered | 1 | Pass: factual role, salutation/sign-off, no invented addressee or visa claim. |
| International Relocation letter | 1 | Not ready by design | Not separately rendered | 1 | Pass: relocation prose derives from explicit preference/location. |
| Technology/Startup letter | 1 | Not ready by design | Not separately rendered | 1 | Pass: project/technology prose derives from explicit reviewed data. |

Page counts are from the new QAT-04 fixture matrix; existing DOC-04/05/10/11/12 suites retain their independent pagination and entitlement fixtures.

## QAT-04 item results

1. **Global ATS:** canonical identity/contact, summary, ordered employment/education/skills/certifications/projects/languages/additional data, optional omission, text extraction, no archived-row loader path, and no normalized duplicate skills covered. ATS format remains a single-column model without critical header/footer content.
2. **Domestic 1–5:** each tested independently on A/B/C/D and retains distinct model/theme composition. Factual content, long bullets, dates, printable bounds and section/first-role grouping pass. Visual distinction and whitespace need final human inspection.
3. **GCC:** with-photo and without-photo PDFs both contain searchable facts. The image object appears only in the supplied-photo variant. No nationality, visa or demographic facts are added by the builder.
4. **European:** explicit dates, employment, education, skills and stored language proficiency pass. No invented CEFR/nationality/work-rights content is permitted by the existing checks.
5. **Cover letters:** General Corporate, International Relocation and Technology/Startup each produce one-page A/D outputs with deterministic reviewed facts, salutation and sign-off. Existing DOC-12 tests cover sparse rejection and long-evidence omission. Human prose/line-break approval remains pending.
6. **Pagination:** every C resume is multi-page (5–8 pages); the experience heading and first role appear together. PDF.js geometry finds no text outside 12-point page bounds, same-line text collision, or blank trailing page in the tested fixtures. Human review is still needed for one-bullet next pages, nearly empty pages, exact visual spacing, and image crop.
7. **Missing fields:** B omits absent optional sections and contact routes without `N/A`, `undefined`, blank headings, or doubled separators. Existing template-specific tests cover missing grades, dates, credential URLs, locations and proficiency. The mapper blocks missing required identity/content instead of fabricating values.
8. **Filename consistency:** all eleven output kinds have deterministic `.pdf` labels; unsafe path/control characters are removed, Unicode is retained where valid, and candidate stems are bounded. The masked ATS filename uses the non-reversible `ZV_CAN_…` reference rather than candidate identity. See matrix below.
9. **Defect log:** two confirmed defects were fixed; neither remains open after the targeted regression. Unperformed human checks are listed as QA gaps, not closed defects.

## Filename matrix

Each ordinary filename is `<sanitized candidate name>_<label>.pdf`:

| Output | Label |
| --- | --- |
| Global ATS | `Global_ATS_Resume` |
| Domestic 1–5 | `Domestic_Resume_1` through `Domestic_Resume_5` |
| GCC | `GCC_Resume` |
| European | `Europass_EU_Resume` |
| General Corporate | `General_Corporate_Cover_Letter` |
| International Relocation | `International_Relocation_Cover_Letter` |
| Technology/Startup | `Technology_Startup_Cover_Letter` |
| Employer-masked ATS | `ZV_CAN_<20-hex>_Global_ATS_Resume_Masked.pdf` |

## Defect register

| ID | Output/template | Fixture | Severity | Reproduction | Expected / actual | Root cause | Fix and regression evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QAT04-001 | Shared PDF renderer; visible in Domestic 2/3, GCC, EU, letters | A long name/role | **High** — copied/searchable facts altered | Render A and extract name or role text. | Expected source words intact; actual PDF text included inserted hyphenation such as `Opera- tions` or `Candi- date`. | React-PDF automatic hyphenation introduced characters at line breaks. | Register one no-auto-hyphenation callback. Long HTTPS display text receives explicit line breaks at 64-character intervals, without added visible glyphs; the hyperlink target is unchanged. A/B/C/D facts and the existing long-URL A4 bounds regression pass. | **Closed** |
| QAT04-002 | Global ATS and any mapper-consuming output | Duplicate alias `MS Excel` / `Microsoft Excel` | **Medium** — repeated skill in candidate output | Feed two stored skills with the same normalized key. | Expected one supplied skill; actual mapper previously emitted both. | Mapper sorted skills but did not apply the shared normalized skill key. | Keep first ordered supplied wording, omit later normalized duplicate, and emit a structured warning. Rendered Global ATS contains one `MS Excel` and no repeated alias. | **Closed** |

No Critical, Low, or additional confirmed defects were found in the automated fixture matrix. This is not a claim that manual visual QA is complete.

## Final verification

- New QAT-04 cases: **17/17 passed**. Full regression: **343/343 passed**.
- `npm.cmd run lint`: passed. `npm.cmd run build`: passed.
- `npm.cmd audit --omit=dev`: zero known production-dependency vulnerabilities.
- `npm.cmd run security:secrets`: passed. `git diff --check`: passed (Git reported only line-ending conversion notices).
- No remote service, real candidate data, migration, commit, or push was used for this QA pass.

## Privacy, package and provenance

The masked ATS variant retains candidate name/career facts but removes personal email, mobile, WhatsApp and LinkedIn from extracted text and link annotations, inserts the stable Zevantaa reference, and leaves the original output unchanged. Metadata does not contain the removed contact routes. The seven frozen packages are routed from the central catalog; non-entitled/unknown outputs fail closed in existing route tests. The server profile loader excludes archived career rows before mapping. No template queries browser-submitted candidate facts.

## Manual PDF inspection still required

Download A, B, C and D from the protected admin QA path for each design, plus GCC with/without photo, all three letters, and an employer-masked ATS copy. Open in at least one desktop PDF viewer; inspect every page for hierarchy, alignment, image crop, whitespace, bullets, one-line orphans, line-end behavior, thin/empty final pages, header/footer collisions, and professional polish. Try selecting/copying/searching the long name, role titles, accented name, email and URLs. Confirm the masked PDF has no clickable direct-contact annotation. Record screenshots using fictional data only.
