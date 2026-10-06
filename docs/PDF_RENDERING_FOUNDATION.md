# PDF rendering and download foundation (DOC-03-01–08)

This is a server-only, transient PDF layer. It does not load profiles, authorize
users by itself, generate final resume layouts, or persist files. Authorization
belongs to the server route before candidate-specific model construction.
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

## Optional running header and footer

`PdfDocumentModel.header` and `.footer` accept `PdfPageAdornment` with optional
`text`, `reference`, `alignment` (`left`, `center`, `right`), and `pageNumbers`
(`current` or `current-of-total`). They are absent unless supplied explicitly.
The same controls are suitable for later resume, cover-letter and masked-review
templates; no brand-specific header or footer is built into the renderer.
When enabled, a fixed adornment repeats on every page. The renderer reserves an
additional 26 pt above/below the body (16 pt adornment and 10 pt separation),
on top of the configured top/bottom margins. Adornment text is constrained to a
short single line (42 characters, or 36 with page numbers) to avoid overflow;
longer text is rejected rather than silently clipped. Page numbering is
computed after wrapping, so `Page 1 of 3` reflects the rendered page count.

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
in the tested runtime. This common layer contains no final layout, ATS scoring
or public file URL. The first production layout, Global ATS Resume, is described
separately in `GLOBAL_ATS_RESUME.md`.

## Filename and transient HTTP download

`pdf-filename.ts` builds deterministic `<Candidate_Name>_<Document_Type>.pdf`
names from a fixed V1 output-kind union. Resume names can add `_Masked`;
cover-letter masked naming is rejected because only resume masking is in the
frozen record model. Names are Unicode-preserving by default, with an optional
ASCII-only fallback. Unsafe punctuation, slashes, backslashes, controls and
repeated separators become a single underscore. Names are bounded, and a blank
candidate name becomes `Candidate`. No database ID is included. The download
boundary sanitizes the filename again before building HTTP headers.

`renderPdfDownloadResponse(model, filename)` in `pdf-download.ts` returns a
direct `application/pdf` attachment response with a safe ASCII `filename`,
RFC 5987 Unicode `filename*`, byte length, `nosniff`, and `private, no-store`.
It renders in memory and does not need Supabase Storage or a document row. It
must be called only after a server route has established the user's role and
candidate-specific ownership, loaded reviewed data server-side, and built the
model without trusting browser-supplied facts. Renderer failures should be
returned as generic errors without leaking candidate content.

The existing `/admin/pdf-render-test` is a temporary manual QA harness, not a
production template. Its POST-only `/admin/pdf-render-test/download` endpoint
rechecks active admin access and accepts only fixed fictional scenario
keys. The `header-footer` scenario reuses the multi-page fixture, adds the
`Zevantaa Resume Builder QA` header and `Page X of Y` footer, and uses the
direct HTTP download helper for visual review. It rejects cross-origin requests
with a mismatched `Origin`, returns the
PDF directly to the authorized browser, and exposes no public file URL,
storage path or service-role key. The route is not in normal admin navigation.

## QA

`tests/doc-03-01-04.test.mjs` creates fictional in-memory PDFs and opens them
with PDF.js. It checks the `%PDF-` header, nonzero bytes, page count, selectable
text, source order, empty-section omission, Unicode, breaks, margins, and
content preservation through long wrapped sections. `tests/doc-03-05-08.test.mjs`
also checks one/two/3+ pages, running adornments, numbering, body clearance,
heading keep-with-next, filenames, response headers and admin-only QA POST.
These are structural rather than screenshot-only checks. Manual visual review
on desktop/mobile PDF viewers, especially for complex scripts, long running
labels and unusually dense two-column layouts, remains necessary when real V1
templates are built. Automated coordinate checks cannot prove the absence of
every visual collision or guarantee PDF/UA accessibility.
