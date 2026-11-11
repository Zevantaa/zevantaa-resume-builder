# Milestone 3.1 PDF Visual QA Remediation

## Scope and safety

This milestone changes only deterministic PDF composition, template presentation, QA fixtures, and document-rendering tests. It does not change authentication, authorization, package routing, background generation, persistence, storage, versioning, Supabase schema, or production infrastructure.

All rendered examples use fictional QA profiles. Candidate fields continue to come from the existing reviewed structured profile mapping. No regional status, qualification, date, achievement, metric, visa, nationality, notice-period, CEFR, or equivalence value is synthesized.

## Root causes confirmed

1. The shared multi-column block was allowed to wrap. React-PDF therefore paginated the left and right columns independently and delayed later full-width sections until the taller column completed. This caused detached sidebars and poor page utilization.
2. A fixed section-gap view was emitted after the final section. When a preceding page was exactly full, that layout-only spacer created a blank trailing page.
3. Long structured entries did not consistently keep the title/date/employer opening together. A date or heading could remain at the bottom of one page while the rest of the opening moved to the next.
4. Fixed header geometry did not adapt to exceptionally long names, titles, email addresses, locations, or URLs.
5. Domestic 2 and 4 placed unbounded career or supplemental content inside a first-page column composition.
6. Several themes used body and secondary text below the new readability floor.
7. Cover-letter layouts reused resume-like competency grids and generic sentences instead of a business-letter hierarchy grounded in supplied career evidence.
8. GCC and European identity blocks did not give verified regional context sufficient visual hierarchy.

## Shared renderer remediation

- Multi-column compositions are now bounded and remain together; long career content continues in the full-width document flow.
- Final-section layout gaps are omitted, preventing spacer-only pages.
- Long entries keep their title, date, employer, and location opening together while their descriptions and bullets remain safely wrappable.
- Level-one headings and all identity variants use deterministic adaptive font sizing with an explicit minimum.
- Contact tokens are broken only with layout newlines; copied/searchable source text remains intact.
- European and GCC identity blocks now use clearer regional hierarchy without adding candidate fields.
- Theme validation enforces a 9.5 pt minimum body size, 8.2 pt minimum secondary size, and 10.5 pt minimum section heading size.

## Template-by-template result

| Output | Status | Visual QA result |
| --- | --- | --- |
| Global ATS | Remediated | Ruled hierarchy and improved second-page distribution; normal case remains two pages. |
| Domestic 1 | Remediated | Readable 10 pt body, restrained boardroom hierarchy, adaptive long identity. |
| Domestic 2 | Remediated | Sidebar is bounded; skills and career facts continue in logical full-width order; normal case reduced from three pages to two. |
| Domestic 3 | Remediated | Improved body size, line height, and second-page balance while retaining editorial styling. |
| Domestic 4 | Remediated | First-page rail is bounded; unused companion-column space carries verified credentials; long entries flow full width; normal and long-name edge cases use two pages. |
| Domestic 5 | Remediated | Removed blank trailing page, raised typography, and kept entry openings together. |
| GCC Regional | Remediated | Adaptive navy identity, optional photograph, verified regional facts strip, and page-number footer. No unsupported regional facts are added. |
| Europass / European | Remediated | Candidate identity is primary, verified location/relocation context is clearer, contacts wrap safely, and page-number footer is present. |
| General Corporate letter | Remediated | Business-letter hierarchy, no resume-style skills grid, and deterministic evidence-led prose. |
| International Relocation letter | Remediated | Business-letter hierarchy and only explicit location/relocation evidence; no unsupported work-rights or visa claim. |
| Technology & Startup letter | Polished existing design | Improved subject hierarchy, spacing, and footer. The exact external design remains unavailable, so the existing category was not silently replaced. |

## Page-count comparison

The normal profile uses the same fictional source data before and after.

| Output | Before | After |
| --- | ---: | ---: |
| Global ATS | 2 | 2 |
| Domestic 1 | 2 | 2 |
| Domestic 2 | 3 | 2 |
| Domestic 3 | 2 | 2 |
| Domestic 4 | 2 | 2 |
| Domestic 5 | 2 | 2 |
| GCC Regional | 2 | 2 |
| Europass / European | 2 | 2 |
| General Corporate letter | 1 | 1 |
| International Relocation letter | 1 | 1 |
| Technology & Startup letter | 1 | 1 |

Final matrix totals:

| Scenario | Documents | Total pages | Pages below the 25% non-first-page occupancy gate |
| --- | ---: | ---: | ---: |
| Short | 11 | 11 | 0 |
| Normal | 11 | 19 | 0 |
| Extensive | 11 | 42 | 0 |
| Long identity / edge | 11 | 25 | 0 |

The edge scenario includes an exceptionally long name, email, LinkedIn URL, location, and job titles. The extensive scenario includes six employment records, 24 skills, certifications, education, project, languages, and additional information. Missing optional fields and special Latin characters are covered by the short and edge scenarios.

## Visual and automated QA artifacts

- Before PDFs: `output/pdf/milestone-3.1-before`
- After PDFs: `output/pdf/milestone-3.1-after/{short,normal,extensive,edge}`
- Rendered page PNGs and machine reports: `output/visual-qa/milestone-3.1-after/{short,normal,extensive,edge}`
- Labeled contact sheets: `output/visual-qa/milestone-3.1-contact-sheets`

Every generated page was rasterized at 2x resolution. The visual pass checked identity wrapping, section order, entry openings, page endings, grid continuation, sidebars, regional facts, letter hierarchy, footers, and trailing whitespace. Automated tests additionally check A4 geometry, text bounds, text collisions, field preservation, role/date co-location, page occupancy, package routing, authorization boundaries, and searchable PDF text.

These artifacts are intentionally ignored by Git. They contain fictional QA data only and are not deployed.

## Final validation

| Check | Result |
| --- | --- |
| Full test suite | 401 passed, 0 failed |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Next.js production build | Passed |
| Secret scan | Passed; no configured high-confidence pattern found |
| Production dependency audit | Passed; 0 vulnerabilities |
| CycloneDX production SBOM | Generated successfully; 109 components |
| Final PDF scenario matrix | 44 PDFs / 97 pages rendered to PNG; 0 blank or sparse pages under the automated gate |

The test runner emits existing non-failing Node module-type and PDF.js standard-font-data warnings. The dedicated visual renderer supplies the local PDF.js standard-font path and completes without those font-data warnings.

## Modified source and test files

- `src/features/document-generation/pdf/render-pdf.ts`
- `src/features/document-generation/pdf/pdf-theme.ts`
- `src/features/document-generation/global-ats-resume.ts`
- `src/features/document-generation/domestic-resumes.ts`
- `src/features/document-generation/gcc-resume.ts`
- `src/features/document-generation/european-resume.ts`
- `src/features/document-generation/cover-letters.ts`
- `scripts/render-premium-document-examples.mjs`
- `scripts/render-pdf-visual-qa.mjs`
- `tests/doc-05-09-domestic-resumes.test.mjs`
- `tests/doc-17-premium-document-engine.test.mjs`

## Remaining gap

The Technology & Startup cover-letter reference was not supplied in the approved reference set. This milestone therefore improves the existing Technology & Startup format without substituting another category. Exact reference matching remains blocked until that approved target is provided.
