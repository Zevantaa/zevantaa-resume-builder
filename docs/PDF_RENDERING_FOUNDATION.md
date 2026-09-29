# PDF rendering foundation (DOC-03-01–04)

This is a server-only, transient PDF layer. It does not load profiles, authorize
users, generate final resume layouts, persist files, or expose a download route.
The intended flow is:

`reviewed CandidateProfile → mapCandidateProfileToDocumentData → DocumentData → future V1 template → PdfDocumentModel → renderPdfDocument() → PDF Buffer`

The future template supplies only the reviewed fields applicable to that
output. The renderer does not infer missing claims, create placeholder content,
or read private storage. The caller must authorize the candidate profile before
assembling `DocumentData` and must handle the returned Buffer privately.

## Technology choice

| Option | Assessment |
| --- | --- |
| `@react-pdf/renderer@4.9.0` | Selected. MIT, React 19-compatible, Node `renderToBuffer`, A4, flex layout, selectable text, automatic wrapping, explicit breaks, and orphan/widow controls. No browser binary. |
| PDFKit | MIT and server-friendly, with text wrapping and automatic pages, but this application would need to build substantially more heading/entry page-flow and layout behavior itself. |
| `pdf-lib` | MIT and good for drawing/editing PDFs, but lower-level text layout and pagination would need to be authored here. |
| Headless Chromium | Can print HTML but adds a browser installation/runtime burden that is unnecessary for V1's reusable PDF primitives. |

Only `@react-pdf/renderer` is a new runtime package. Its version is pinned in
the lockfile. The font files under `public/fonts/` are copied from pinned Noto
font source packages and carry their included SIL Open Font License 1.1 files.
The temporary font-source packages were removed after copying the assets.
The included Latin, Latin Extended and Devanagari WOFF files total under 350 KB.
No font is read from the developer's Windows installation or fetched from a
network service during rendering. The PDF code uses the Node runtime; a future
route or job must not run it in an Edge runtime.

## Common API and primitives

`src/features/document-generation/pdf/pdf-model.ts` defines the transient
`PdfDocumentModel`. Its ordered sections contain heading, paragraph, bullet
list, contact row, entry, short two-column, and explicit page-break blocks.
Dates and links are supplied text, not parsed or synthesized by the renderer.
`renderPdfDocument(model, themeOverrides?)` in `render-pdf.ts` returns a Buffer.
It has no database or Supabase dependency and is marked `server-only`.
`sourceProfileId` is carried for caller provenance; it is not printed.

The renderer uses A4 portrait with configurable margins. Text wraps at the
available width. A link is active only for `https:`, `mailto:` or `tel:`; other
values render as plain supplied text. Empty sections, paragraphs and bullet
lists are omitted, preserving the original order of nonempty sections. A
`columns` block provides a short-content primitive for future designs; it is
not a finished two-column resume template.

## Page-flow rules

- Section and entry headings reserve room for following content using
  `minPresenceAhead`; text has two-line orphan/widow protection.
- A short entry stays together when its estimated height is less than 35% of
  the usable page body. Longer entries remain breakable so they can continue
  across pages instead of being clipped by `wrap={false}`.
- Each bullet marker and its text are one text element. Long bullet text can
  wrap naturally; the marker is not a separate layout box.
- A `page-break` block applies `break` to the next top-level block. A section's
  `breakBefore` starts that section on a new page.
- The renderer does not enforce a one-page limit. Automated tests cover one,
  two, and at least three pages and inspect PDF text coordinates for content
  outside the physical page.

## Typography and spacing

`pdf-theme.ts` centralizes the bundled font family, 10 pt body, 8.5 pt small
text, 17/12 pt headings, 1.35 line height, 6 pt paragraph gap, 13 pt section
gap and bullet indent, and 42/44 pt page margins. Overrides are merged per
render and validated. A future template can register another licensed font and
override `fontFamily` without changing the renderer.

The embedded Latin fonts support common Western text; a separate Devanagari
font is selected for Devanagari runs. Tests confirm searchable text for common
Latin accents and basic Devanagari. Complex Indic shaping can produce a PDF.js
text-extraction order different from the source's logical character order even
when the glyphs display; verify such output visually and with assistive tools
before a regional template is approved. Other scripts and emoji are not
validated in this batch and require suitable licensed fonts/QA, not silent
substitution. This is a known foundation limit, not a completed market layout.

PDF metadata dates are fixed so identical inputs produce byte-identical output
in the tested runtime. No header/footer controls, final resume or cover-letter
templates, ATS scoring, filenames, public URLs or DOC-04 work are included.

## QA

`tests/doc-03-01-04.test.mjs` creates fictional in-memory PDFs and opens them
with PDF.js. It checks the `%PDF-` header, nonzero bytes, page count, selectable
text, source order, empty-section omission, Unicode, breaks, margins, and
content preservation through long wrapped sections. Manual visual review on
desktop/mobile PDF viewers, especially for complex scripts and unusually dense
two-column layouts, remains necessary when real V1 templates are built.
