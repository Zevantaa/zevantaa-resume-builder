# Zevantaa document-reference reconciliation

Audit completed on 11 November 2026 against the approved read-only source directory:

`C:\Development\zevantaa-design-references`

The directory contains exactly 20 files: 10 HTML files and 10 PDF files. Every supplied HTML file has one corresponding PDF. SHA-256 comparison found no byte-identical duplicates. The sample candidate content is fictional design-reference content and is not a data source for the application.

## Exact pairs

| Frozen output | HTML source (bytes; SHA-256) | PDF target (pages; bytes; SHA-256) | Reconciliation |
| --- | --- | --- | --- |
| `global-ats-resume` | `aaradhayay_global_ats.html` (5,111; `C40B880E4C5C3F4C335C558F79F99CF51C1BD37AF91AB5039B782C410365EBBC`) | `Global ATS Resume (1).pdf` (1; 115,330; `672B84247CCDE71AC8BFE26FB4B392BBD4B4D435B359D1CFAB86A26522CD5198`) | Matched |
| `domestic-resume-1` | `ratan_mishra_variant1_navy_gold.html` (9,901; `9CFF7FC2FA772C672C28AC5B63AE9D47DC3B046D6B7CFCF6EEA8B8FF81AC0E62`) | `Variant 1 - Royal Navy & Gold Boardroom.pdf` (2; 251,544; `02477C12D7573AA69AFEF144804F460B75C57E311B0A2F85568F8FEDBAAB3C83`) | Matched |
| `domestic-resume-2` | `ratan_mishra_variant2_sidebar.html` (9,027; `9C514AEEB844149689667E94FFC0898F3C88995E0299D2A8ADB3A248F8F35763`) | `Variant 2 - Contemporary Executive Sidebar.pdf` (2; 150,286; `EAD605FBD7C47E30088E74B6761AD0969F9FEEB797B30090899E3133BAA8AFBB`) | Matched |
| `domestic-resume-3` | `ratan_mishra_variant3_masthead.html` (10,461; `7D2226D3E31729A62F114B624F61697CDB3223F47C578D2059F9E6FF1AD53F5D`) | `Variant 3 - Editorial Prestige Masthead.pdf` (2; 252,365; `FBE7E720123BCF4390F575885051BEA8D55DF330982EB540D1E19DDC1CDB7DE3`) | Matched |
| `domestic-resume-4` | `ratan_mishra_variant4_splitgrid.html` (7,788; `8D27C31F327130871B23D7281A94FC4F45D4906E8E084873904B6356E74D67B5`) | `Variant 4 - Split-Grid Executive.pdf` (2; 160,634; `00CAFDD6590AC783B6C4C3E612967A62BD67F744BFE8865B152D74794BCB3B52`) | Matched |
| `domestic-resume-5` | `ratan_mishra_variant5_gold.html` (9,171; `67C95A3208BD8DA5462E536DCC4682CA61A041CEA391E9DFFD6EC63483C8F988`) | `Variant 5 - Executive Gold Accent.pdf` (2; 169,214; `F9D8F91C62B508E92A548205E7A911433294E95039BABC964EA442C77395DF6F`) | Matched |
| `gcc-resume` | `aaradhayay_gcc_resume.html` (5,140; `20FACE1DECDB69439878FC25FB4408F95486630C5239D304FD5FB16E3918A2FF`) | `GCC Regional Resume (1).pdf` (1; 122,188; `A3C7479659BDA9DA424B77B07E5DDC1C7241CCA51BCC0F9478F9DAE5DC474B3F`) | Matched |
| `europass-eu-resume` | `aaradhayay_europass_cv.html` (6,447; `CCC3FD8961A60A79E76A3E79D379E37CC9AF8AB36DC9AF661656FD1F97FD0DE7`) | `Europass EU CV (2).pdf` (1; 95,073; `A201479047BE4B708E180B7246D376B87B09FFA3E289B3D2AC3860C5D1B73136`) | Matched |
| `general-corporate-cover-letter` | `aaradhayay_cover_letter_corporate.html` (4,683; `B3D7385636D4C729672BBAACE76346C8CA82EFB221499832C37C3B3C08D79DC5`) | `Cover Letter - General Corporate (Executive).pdf` (1; 167,534; `849945558ACFBD471145C02F4D9F9D1DEC68F9A28E8C75CF84588E3A39C161A2`) | Matched |
| `international-relocation-cover-letter` | `aaradhayay_cover_letter_relocation.html` (5,048; `9704712055CA632C75F67EF5E6312E5867B55D47BF85DE61741C88187B27C69E`) | `Cover Letter - International Relocation (2).pdf` (1; 124,520; `663AAE21095E58139862A32EEF0AFACB87C02D832CF6E19F514B78499D9BB15F`) | Matched |
| `technology-startup-cover-letter` | Not supplied | Not supplied | Missing; existing template retained without substitution |

## Domestic design differences

The five executive references replace the former internal visual treatments without creating new output IDs:

1. **Royal Navy & Gold Boardroom** — navy boardroom masthead, gold accents and three-column competency grid. It replaces Executive Classic styling.
2. **Contemporary Executive Sidebar** — navy/cyan identity band, light profile rail and structured career flow. It replaces Modern Professional styling.
3. **Editorial Prestige Masthead** — editorial display heading, navy/gold rules and a compact competency grid. It replaces Compact High-Density styling while retaining readable body sizes.
4. **Split-Grid Executive** — dark profile rail with gold divider and cyan metadata accents. It replaces Contemporary Sidebar styling. Long career history continues at full width instead of being clipped in a fixed-height grid.
5. **Executive Gold Accent** — white-space-led layout, restrained gold rules and two-column competencies. It replaces Premium Minimal styling.

## Compatibility findings

- The references are fixed A4 HTML samples with fictional values, manual page wrappers and absolute footers. They contain no trusted dynamic bindings.
- The production renderer remains `@react-pdf/renderer`, preserving searchable/selectable text, deterministic page flow and the existing storage/version pipeline.
- Fixed sample page counts are not imposed on live profiles. Long histories flow to additional A4 pages rather than shrinking or dropping facts.
- The structured profile has no verified nationality, visa-status, work-rights, target-company, recipient-address or exact application-date fields. Those sample values are omitted; no migration or inference was introduced.
- The GCC photograph remains conditional and is resolved only through the private-storage service. No public URL or placeholder photo is emitted.
- The Europass target is treated as a European-format presentation. It does not claim official Europass validation, CEFR assessment, nationality or work rights.
- Technology & Startup has no category-matched reference. Its existing template remains in place until a specific design is approved.
- A full-height colored sidebar cannot safely repeat across arbitrary flowing pages with the current server PDF primitive. Split-grid/sidebar designs therefore use a bounded opening rail followed by full-width chronological entries, preserving content and reading order.

## Frozen architecture preserved

All changes remain behind the existing `V1_DOCUMENT_OUTPUTS` order and package-entitlement checks. Templates consume only `DocumentData` from the canonical structured profile mapper. Background jobs, private storage, PDF versioning, ATS snapshots, administrator/client authorization and RLS boundaries are unchanged.
