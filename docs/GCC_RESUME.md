# GCC / Middle East resume (DOC-10-01–06)

The GCC resume is one frozen-V1 output, built from the same reviewed canonical
`CandidateProfile` and `mapCandidateProfileToDocumentData` projection used by
Global ATS and the domestic suite. It does not create another candidate-data
store or infer regional personal details. The production flow is:

`active admin + linked client user ID → canonical profile → document mapper →
GCC entitlement → private optional photo resolution → GCC model → common A4 PDF
renderer → private, no-store PDF download`.

## Design and mapping

The selectable-text layout has a restrained dark identity band, an optional
right-hand portrait, prominent stored current-location/relocation preference,
plain contact details and accent section headings. The career content is a
full-width flow rather than narrow columns. White-on-dark identity text and
dark-on-white body text remain legible in grayscale. No Zevantaa logo, rating
bars, icons standing in for text, or image-based candidate text is added.

The header uses stored name, current location, and the explicit relocation
preference only. `not-specified` is omitted; `open`, `conditional`, and
`not-open` are displayed as preferences, **not** visa or employment-eligibility
claims. Email, mobile, optional WhatsApp and LinkedIn are selectable text below
the band. The remaining order is summary, employment, education, skills,
certifications, projects, languages and candidate-supplied additional sections.
Employment preserves title, employer, optional location, exact supplied dates,
description and highlights. Education preserves exact month/year or year-only
dates and supplied result. Certifications likewise keep only supplied dates,
issuer and credential details. All child arrays retain canonical `(sortOrder,
id)` ordering. Missing optional sections and details have no heading, frame,
`N/A`, or invented value. Long URLs gain presentation-only line breaks without
changing the underlying characters.

The pure `buildGccResumeModel` neither queries Supabase nor accepts uploaded
facts. It requires the mapper's readiness result and an active package whose
authoritative `resumeFormatFamilies` includes `gcc-middle-east`. The four
eligible codes are `gcc-middle-east`, `domestic-gcc`, `global-mobility-master`,
and `executive-transition-agency-distribution`; other/unknown packages are
rejected. Package labels and entitlements are not duplicated in the template.

## Optional private photograph

The admin route first reloads the linked canonical profile after its active
admin check. A separate server-only resolver looks up that profile's current
`gcc_photo_file_id` and requires a matching `file_records` row: same profile,
`gcc-profile-photo` purpose, `available`, unarchived, private access, exact
server-derived object key, matching JPEG/PNG/WebP extension and MIME type, and
the existing 5 MB limit. It also verifies that `candidate-intake-private` is
not public before downloading through the server-side Supabase client. No
browser-supplied file ID, bucket path, URL, or image bytes are used; no signed
or public URL is created. The original object is not changed.

Downloaded bytes must match the recorded size and the existing intake file
signature rules. `sharp@0.35.4` (Apache-2.0; pinned direct dependency) decodes,
autorotates, center-crops and converts the image in memory to a 240 × 300 PNG
with a 20-million-pixel decode limit. The PDF embeds this portrait at a fixed
4:5 ratio, avoiding stretch. WebP is accepted at intake but converted because
the PDF image primitive directly supports JPEG/PNG. If the reference, private
bucket, download, signature, or decode fails, the photo is omitted and the
header expands to full width. The page labels a linked photo as such, not as a
guarantee that a corrupt file will render. No empty photo placeholder appears.

## Production download and QA

`/admin/clients/[userId]/gcc-resume` shows readiness and linked-photo state.
Its POST-only `/download` route rechecks admin access through the existing
canonical loader, validates same-origin requests, reloads stored facts, rejects
non-entitled/incomplete profiles before fetching a photo, and uses the existing
`renderPdfDownloadResponse` with `private, no-store` headers. The deterministic
filename is `<Candidate_Name>_GCC_Resume.pdf`; long names retain the suffix.
No generated PDF, candidate facts, or image is persisted by this route.

The unlinked, protected `/admin/pdf-render-test` harness has three fixed
fictional scenarios: with photo, without photo, and long-content stress. Its
photo is a programmatically generated non-person color image, not a real
portrait or client file. Structural PDF.js QA checks selectable text, page
geometry, image presence/absence, section order, omission, long URLs and
package/security boundaries. In the tested runtime the normal cases rendered
to two A4 pages with and without the photo, and the long case to five pages;
these are observations, not fixed page counts.

Manual visual review remains required for crop quality on actual approved
portrait uploads, page breaks, grayscale print, complex-script shaping and
viewer-specific rendering. This is a professional regional layout, not a
universal ATS-compatibility or employment-outcome guarantee. No nationality,
visa, passport, date of birth, marital status, religion, gender or salary
claims are inferred. DOC-11 and cover letters are separate modules.
