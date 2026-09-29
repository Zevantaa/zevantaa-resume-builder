# Resume text extraction (DOC-02-01–04)

This is a server-only, in-memory text-extraction foundation. It reads an
authenticated client's **current private source resume** and returns ephemeral
text plus structured status. It does not persist extracted text, parse resume
sections, update `candidate_profiles`, score ATS, or generate documents.
The reviewed structured candidate profile remains the authority for all later
outputs; extraction is only raw source material for a later review step.

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
There is no route or UI trigger in this batch.

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
- No semantic section detection, candidate-fact mapping, profile writes,
  extraction persistence, UI/API invocation, ATS logic, or templates are added.
  Those belong to later tracker tasks, beginning with DOC-02-05.

Tests use fictional in-memory DOCX/PDF documents and a generic MIT-licensed
OLE DOC parser fixture described in `tests/fixtures/README.md`; they do not
use real client data or public storage.
