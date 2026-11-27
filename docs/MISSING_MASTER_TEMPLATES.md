# Missing and incomplete master references

Audit date: 28 November 2026. Physical source: `C:\Development\zevantaa-design-references`. See `MASTER_TEMPLATE_INVENTORY.md` for all 11 V1 mappings and the reproducible hash/page audit. The directory has exactly 10 HTML/PDF pairs. No other local reference directory is explicitly documented by this project.

## A — Complete asset pairs

Global ATS, Domestic 1–5, GCC Regional, Europass/EU, General Corporate and International Relocation each have a named HTML and PDF pair. The PDF pages were rendered and visually inspected; each page contains selectable text. There is no approved-version manifest, so exact HTML-to-PDF provenance and final sign-off remain unverified. Their implementation is not yet exact-fidelity approved. The source PDFs contain fixed fictional facts and placeholders, which must never become generated candidate assertions.

## B — Partial pairs

None found among the 20 supplied files.

## C — Conflicting or outdated references

No duplicate competing master file was found in the supplied directory. Existing `docs/DESIGN_REFERENCE_INVENTORY.md` calls the pairs “matched”; that describes file association, not measured layout equivalence or an independently verified approval version. The source PDF for Europass contains an EU-flag-style wordmark, while the earlier `docs/EUROPEAN_RESUME.md` explicitly avoids official branding. Zevantaa must decide the permitted wordmark/endorsement treatment before claiming exact fidelity. Priority: **High**; existing European-style output can remain available.

## D — Missing V1 master

| Document | Required HTML filename | Required PDF filename | Available | Missing / effect | Safe interim action | Required from Zevantaa | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Technology & Startup Cover Letter | Not specified in supplied references | Not specified in supplied references | Existing category-specific generator in `src/features/document-generation/cover-letters.ts` | Both master files and approval/version record; blocks **exact fidelity for this output**, not processing of other outputs | Retain the existing Technology & Startup letter without presenting it as master-matched | Supply the final approved Technology & Startup HTML, its PDF produced from the same design revision, font/assets licence and approval date | **Critical** |

## E — Proposed new document families without V1 entitlement

| Proposed document | HTML / PDF filename | Existing mapping | Missing decision and asset | Development effect | Priority |
| --- | --- | --- | --- | --- | --- |
| Germany Tabellarischer Lebenslauf | Not specified / not specified | No separate V1 output | Approved final master and which existing output, if any, it replaces; package entitlement | Can develop reusable German data validation, but cannot publish an extra document | **High** |
| DIN 5008 Anschreiben | Not specified / not specified | No separate V1 output | Same, plus recipient/address/signature rules | Cannot add an entitled letter | **High** |
| GCC mobilization letter | Not specified / not specified | Possible wording within International Relocation letter, not a separate output | Decide adaptation versus new output; approved final layout | Verified wording can be conditional in the existing letter once facts are stored | **Medium** |
| EU motivation letter | Not specified / not specified | Possible adaptation of an existing letter; no separate output | Decide entitlement and final master | No extra output may be queued | **Medium** |

## Incomplete content specifications within supplied V1 pairs

| Output | What is available | Missing | Blocks development? | Required from Zevantaa | Priority |
| --- | --- | --- | --- | --- | --- |
| Global ATS | A4 HTML/PDF and current selectable single-column generator | Market selection for India, Global MNC, USA, Canada, UK, Australia; required regional fields; target job and JD handling; Letter-size rule | Does not block existing A4 output; blocks market-specific approval | Confirm field labels, optional/required rules, and which markets require US Letter | **High** |
| GCC Regional | HTML/PDF and conditional photo generator | Provenance/requiredness for nationality, visa/work status, notice, licence, marital and mobilization details; photo consent/placement | Does not block current fact-safe output; blocks exact meta-grid | Approve questionnaire, privacy/retention rules and sample with missing optional facts | **High** |
| Europass/EU | HTML/PDF and European-style generator | Five-axis CEFR, mother tongue, verified EQF, EU/EEA work authorization, photo policy, wordmark decision | Does not block current fact-safe output; blocks full regional claim | Approve field validation and wordmark use; provide completed/empty examples | **High** |
| General and Relocation letters | Both HTML/PDF pairs and data-grounded generators | Recipient/company/date sources and conditional business-letter blocks; relocation source facts | Does not block existing safe letters; blocks exact composition | Approve omissions when no target recipient or visa facts exist | **Medium** |

No new reference design has been invented. The missing Technology pair is the only absent frozen-V1 asset pair; regional content specifications and new-family entitlement decisions are separate gaps.
