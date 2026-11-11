# Milestone 3 — premium document engine

## Implemented scope

- Added presentation-only PDF primitives for premium identity bands, competency grids, editorial/gold section rules and bounded sidebar/split-grid openings.
- Mapped the five approved executive references to the five existing domestic output IDs.
- Upgraded Global ATS, GCC, European, General Corporate and International Relocation outputs from supplied references.
- Preserved the existing Technology & Startup cover-letter template because its reference is missing.
- Kept every output bound to reviewed `DocumentData`; no sample candidate values, fabricated claims or duplicate profile store were introduced.
- Kept all seven packages, eleven-output routing, background generation, private storage, version publication, ATS snapshots and authorization paths unchanged.

## Rendering policy

- A4 pages retain selectable text.
- Long unspaced contact values receive presentation-only line breaks; removing whitespace restores the source value.
- Optional sections are omitted when empty.
- Long entries wrap across pages; section headings stay with opening role metadata where safe.
- Sidebar content is bounded to the opening composition. Long chronology continues at full width.
- No template forces a one-page result.

## Validation coverage

The document suite covers sparse, complete, extensive and special-character profiles across all eight resumes and three cover letters. It checks A4 bounds, text collisions, searchable content, long URLs, explicit dates, optional photos, privacy masking, package authorization, route tampering, storage isolation and deterministic filenames.

Milestone-specific tests verify approved domestic design routing, premium block selection, category-specific cover-letter behavior and preservation of the Technology & Startup fallback.

## Remaining design gaps

- No Technology & Startup HTML/PDF reference is available.
- No approved verified fields exist for nationality, visa status, work rights, recipient address or target company.
- Exact reference fonts are not bundled; selectable, fallback-safe rendering takes precedence over host-dependent typography.
- Full-height repeating sidebars are intentionally not reproduced across arbitrary long documents because that can cause clipping or duplicate reading order.
