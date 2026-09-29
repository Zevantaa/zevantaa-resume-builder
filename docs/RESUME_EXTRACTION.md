# Resume text extraction and admin review (DOC-02-01–07)

This server-only foundation reads a private source resume and returns ephemeral
text plus structured status. The admin review workflow can now propose
structured data; only explicit confirmation writes approved values to the
canonical candidate profile. It does not score ATS or generate documents.

## Libraries and formats

| Format | Pinned package | License | Use |
| --- | --- | --- | --- |
| Legacy OLE `.doc` | `word-extractor@1.0.4` | MIT | `getBody()` from an in-memory Buffer; no Office/LibreOffice process |
| `.docx` | `mammoth@1.13.0` | BSD-2-Clause | `extractRawText()` from an in-memory Buffer; paragraphs and table-cell paragraphs in document order |
| Text `.pdf` | `pdfjs-dist@5.4.624` | Apache-2.0 | PDF.js legacy Node build; text items by page/content order, no rendering or OCR |
| DOC TypeScript declarations | `@types/word-extractor@1.0.6` | MIT | Development-time typings only |

The installed versions are exact-pinned in `package.json` and
`package-lock.json`. PDF.js 5.4 requires Node 20.16+ or 22.3+; deployment must
meet that runtime requirement. No paid API, native office suite, cloud OCR, or
temporary disk file is used. DOC macros/embedded content are not executed;
DOCX with a `vbaProject.bin` member is rejected. DOCX is preflighted for a
40 MiB total uncompressed-size limit and 1,000 archive entries. PDFs are
limited to 100 pages and extraction to 2 million characters. The existing
upload cap remains 10 MiB for source resumes.

## Entry point, provenance, and privacy

`extractCurrentClientSourceResume()` in
`src/features/document-generation/current-client-resume-service.ts` accepts
**no browser-provided ID or path**. It reuses the active-client role/profile
resolver, loads only that non-archived profile's `existing_resume_file_id`,
then reads an available, non-archived, private `source-resume` file record with
the same `candidate_profile_id`. It requires the exact server-generated object
key `<profile-id>/source-resume/<file-id>.<extension>`, the approved
`candidate-intake-private` bucket, and a bucket `public = false` check before
calling Supabase Storage `download`. No public or signed URL is created. The
secret/service-role key remains in the existing server-only admin client.

The result carries source file ID, MIME/extension, extractor name, raw and
normalized text, PDF page count when known, generic warnings, status, and
failure reason. This preserves source provenance while returning no storage
object key. Failed or unsupported extraction is **not** an empty successful
resume. The original uploaded object and file record are never modified. The
raw text can contain confidential candidate data: callers must keep it on
trusted server paths, avoid logging it, and not expose it to other clients.
The protected `/admin/clients/[userId]/resume-review` route resolves a
provisioned client to its linked profile server-side and reuses the private
file checks and extractor. The existing client QA route cannot confirm data.
Neither route accepts a browser-supplied profile ID, file ID, bucket or path.
The admin layout and confirmation action require an active authoritative admin
role independently.

## Admin review and provenance (DOC-02-05–06)

The deterministic parser recognizes known summary, employment, education,
skills, certifications, languages, projects and additional-section headings.
It preserves source line numbers and order. Employment accepts an explicit
`Job title | Employer | [Location |] Mon YYYY - Mon YYYY/Present` header,
normalizes months to `YYYY-MM`, and attaches following bullets to that job.
Education and certifications accept stated year-only or month-year dates;
year-only values are stored separately rather than inventing January. Explicit
grades and expiry dates are preserved. Skills split under common skills
headings, languages split on list separators with only supported explicit
proficiency, and a project title owns following bullets/description. Document
header lines before the first recognized section are ignored without warnings.
Ambiguous entries warn once rather than flagging every attached bullet. The
administrator can accept/reject individual
proposals and edit approved values before confirmation. Such edits are
admin-entered facts, not inferred by the parser. Existing child rows are
appended, not replaced. Only an explicitly selected summary can update the
canonical summary; admin-owned contact, login, location, relocation and package
fields are untouched.

The new migration creates `profile_resume_reviews` with RLS and a service-role-
only `confirm_resume_review` function. In one database transaction it locks the
profile, checks its current private source and active admin role, records the
source file ID, extractor, normalized-text SHA-256, selected approved entries
and source lines, actor and confirmation time, and writes the approved canonical
facts. A unique profile/file pair prevents a second import of that source.
Child audit notes reference the review and source file. The original upload
and full extracted text are not changed or persisted. Approved facts can be
traced to the private source via the review record; unselected proposals can be
reconstructed by re-extracting the unchanged file. The forward-only
`20260929000300_doc_02_06_live_parser_fields.sql` migration adds exact-year
columns and a `confirm_resume_review_v2` wrapper that atomically persists
reviewed locations, bullets, descriptions, grades, years, supported language
proficiency and project text. Apply both review migrations before confirmation
QA; without them confirmation fails closed.

## Malformed-file QA (DOC-02-07)

Malformed DOC/DOCX/PDF, encrypted PDF, unsupported MIME, image-only PDF and
insufficient text retain structured failure outcomes. They cannot be confirmed
as successful extraction. Tests cover those outcomes, ambiguous structure,
admin confirmation and profile isolation.

## Normalization and outcomes

The shared `normalizeExtractedText()` converts CRLF/CR to LF, page breaks to
section-like blank lines, tabs/non-breaking spaces and repeated horizontal
space to one space, removes obvious non-printing control characters, trims
lines, and caps consecutive blank lines at one. It preserves bullet characters,
line order, and detectable paragraph/page boundaries. It does not infer
headings or rewrite text.

Statuses are `success`, `insufficient-text`, `unsupported`, and `failed`.
Unsupported MIME/extension pairs, encrypted PDFs, macro-bearing DOCX, and
extraction limits return explicit reasons. Malformed files fail safely.
Fewer than 20 letters/digits in normalized output returns
`insufficient-text`, including image-only/scanned PDFs; this is a conservative
review signal, not a claim about the candidate. Low-text PDF pages generate a
generic warning. Parser exception text is not returned or logged.

## Known V1 limits and deferrals

- Text-based PDFs only. Scans, images, and protected/encrypted PDFs need manual
  review; OCR is not included.
- Complex multi-column reading order, DOCX text boxes/shapes, legacy DOC edge
  cases, and PDF layout reconstruction can be imperfect. Text extraction does
  not validate the truth of any statement in a source resume.
- This is strict rule-based mapping, not semantic understanding. Complex
  layouts and narrative-only histories need manual handling in a later task.
  OCR, ATS logic, templates, rendering and DOC-03 remain deferred.

Tests use fictional in-memory DOCX/PDF documents and a generic MIT-licensed
OLE DOC parser fixture described in `tests/fixtures/README.md`; they do not
use real client data or public storage.
