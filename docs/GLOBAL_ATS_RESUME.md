# Global ATS Resume (DOC-04-01–04)

This is the first V1 production resume layout. It is a restrained A4,
single-column, selectable-text PDF. It is **not** an ATS score, an ATS vendor
certification, or a guarantee that every applicant-tracking system will parse
the document identically.

## Data flow and ownership

`loadAdminCandidateProfile(userId)` resolves a provisioned client's linked
candidate profile after an active-admin role check. It loads the unarchived
canonical parent and child rows, including additional-section items, in batches
and maps database snake_case fields into the existing `CandidateProfile` type.
The live database must include the existing DOC-01 `grade_result` migration and
DOC-02 year-only `completion_year`/`issue_year`/`expiry_year` migration; this
task creates or applies no migration.
The admin-only loader uses the server-side Supabase administration client; no
secret is imported by browser code. The candidate ID comes from the trusted
`user_roles` link, not a posted value.

`mapCandidateProfileToDocumentData(profile, "resume")` then produces the
layout-neutral, ordered projection and readiness findings. The pure
`buildGlobalAtsResumeModel(mapping)` produces a `PdfDocumentModel`; it neither
queries Supabase nor alters the canonical profile. The common
`renderPdfDownloadResponse` finally returns a transient PDF attachment.
No duplicate resume-specific profile table, storage object or document record
is created by this path.

## Layout and field mapping

The fixed sequence is candidate name, plain-text contact details, professional
summary, professional experience, education, skills, certifications, projects,
languages, then candidate-supplied additional sections. Only nonempty sections
are included. No Zevantaa branding, photo, running header/footer, columns,
tables, decorative icons or ATS score appear in the candidate resume.

| Canonical document data | ATS presentation |
| --- | --- |
| `identity` | Name heading; email, mobile, optional WhatsApp, LinkedIn URL and location in plain text |
| `professionalSummary.text` | Candidate-supplied paragraph, unchanged |
| `employment[]` | Job title and employer; optional location and explicit date range; description and supplied highlight bullets |
| `education[]` | Qualification and institution; optional field, location, exact dates/year, result and highlights |
| `skills[]` | Individual names, with stored category when present |
| `certifications[]` | Name and issuer; only explicitly stored issue/expiry dates or years, credential ID/URL |
| `projects[]` | Name; optional role, dates, URL, description, technologies and highlights |
| `languages[]` | Language name and explicitly stored proficiency |
| `additionalSections[]` | Stored section title and ordered items, descriptions and highlights |

The canonical mapper orders each array by `(sortOrder, id)`. Month values in
`YYYY-MM` are displayed as `Mon YYYY`; year-only education and certification
values remain exact years. An explicitly current role displays `Present` and
does not gain an invented end month. The layout does not rewrite summaries,
add keywords or fabricate metrics, achievements or credentials.

## Omission and failure policy

Absent optional sections have no heading or placeholder. Blank optional detail
lines and bullets are omitted. The mapper's `canGenerate=false` findings block
output for missing required identity, contact, package/market context or all
structured career content. The builder also checks the required identity and
package fields defensively. A partial optional entry renders only its stored
parts; a certification without dates does not gain a fake issue or expiry date.

## Admin download and filename

The protected `/admin/clients/[userId]/global-ats` readiness screen is linked
from the existing client account editor. Its POST-only `/download` route
rechecks active administrator access and reloads the linked canonical profile
on the server. It does not accept posted resume facts or a candidate profile ID.
If the profile is missing or incomplete it returns a non-PDF response; renderer
failures produce a generic error. The download uses the existing private,
no-store PDF response helper and deterministic
`<Candidate_Name>_Global_ATS_Resume.pdf` filename builder. No internal ID,
private storage path or public file URL appears in the download name.

## ATS-friendly decisions and limitations

The core content is a simple vertical text flow with standard headings and
ordinary bullets. Names, contact details, employers and dates remain
selectable/searchable text, rather than an image. Tests inspect generated PDF
bytes and extracted text, including long and Unicode content. The shared PDF
font limitations documented in `PDF_RENDERING_FOUNDATION.md` still apply,
especially to complex Indic shaping/copy order. PDF parsing behavior varies by
ATS product, so real-world upload testing is still needed; no compatibility
claim or score is made here. Candidate editing, client-facing generation,
other resume layouts, cover letters and DOC-04-05 scoring are separate tasks.
