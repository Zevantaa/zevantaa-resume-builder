# European-structured resume (DOC-11-01–05)

This V1 output is a professional European-structured resume, **not** an official
Europass document or an assertion of compliance with an official Europass
standard. It uses no Europass branding. It reuses the reviewed canonical
`CandidateProfile`, the layout-neutral `mapCandidateProfileToDocumentData`
projection, and the common A4, selectable-text PDF renderer. There is no
second resume database, paid AI service, or template-owned candidate facts.

## Layout and facts

The first page has a restrained two-zone identity area: a small profile rail
and a wider name/contact/location area. Career content below it is full-width
and single-column, distinct from the GCC dark identity band and the domestic
suite. A muted blue-grey rule marks conventional section headings. No flags,
logos, photos, pictograms, tables, decorative charts, or image-based text are
used. The content order is professional profile, work experience, education
and training, skills, languages, certifications, projects, and any supplied
additional sections. Empty optional sections and details are omitted entirely.

All visible values come from stored/reviewed fields. The identity uses name,
email, mobile and, only when present, WhatsApp, LinkedIn, current location and
explicit relocation preference. Employment uses title, employer, optional
location, exact start/end or explicit current-role state, description and
highlights. Education retains year-only or month-year dates and supplied
result. Language proficiency is displayed only when stored, using its literal
canonical value in readable words; it is **not** converted to CEFR. A missing
proficiency remains absent. Certifications retain their explicitly supplied
issuer, dates, credential ID and URL, without inventing expiry. Project and
additional-section text is likewise preserved. Child entries retain canonical
`(sortOrder, id)` order. The template does not infer nationality, work rights,
visa status, address, date of birth, scores, qualifications, or outcomes.

The professional content flows through normal PDF pages. Each employment
entry's opening title, date, employer and location is grouped on one page;
its description and bullets may continue on later pages. Section headings
stay with the first structured entry opening. Long LinkedIn values receive
presentation-only line breaks without changing their underlying characters.
Critical candidate facts are in the page body, not a running header/footer.

## Package, access and download

`buildEuropeanResumeModel` is pure and validates the mapper's readiness result
and the frozen package catalog's `europass-european-union` format-family
entitlement. The eligible package codes are `europass-european-union`,
`domestic-europass-european-union`, `global-mobility-master`, and
`executive-transition-agency-distribution`. Other, inactive or unknown
packages fail closed; there is no alternate hard-coded entitlement table.

`/admin/clients/[userId]/european-resume` shows server-computed readiness.
Its POST-only `/download` path rechecks admin authorization through the
existing canonical profile loader, rejects cross-origin requests, reloads
reviewed facts, and ignores browser-supplied names/profile data. The PDF is
rendered in memory and returned with private, no-store headers. It is not
persisted or given a public storage URL. The existing output-kind label
produces `<Candidate_Name>_Europass_EU_Resume.pdf` for continuity with frozen
V1 filenames; that filename does not claim official Europass status and the
content itself makes no such claim. Internal IDs are excluded from the name.

The unlinked, admin-only `/admin/pdf-render-test` harness offers fixed
fictional normal and long European scenarios. It does not read real candidate
records or appear in ordinary navigation.

## QA and limits

PDF-level regression covers entitlement, minimal-section omission, all
supported sections, date and result preservation, page order, selectable
text, role-metadata grouping, A4 geometry, safe filename, admin-only download,
same-origin handling and submitted-fact rejection. In the tested runtime the
minimal fixture rendered to 1 page, normal to 2 and long to 5. These are
observations, not hard-coded page limits. Manual review should still inspect
actual PDFs for viewer-specific line breaks, complex-script shaping, visual
balance, grayscale print and candidate-specific long unbroken links. No
universal ATS compatibility or employment outcome is guaranteed.

Cover letters and DOC-12 remain separate work.
