# Domestic resume suite (DOC-05 through DOC-09)

Five V1 domestic-market PDF designs consume the **same reviewed canonical
candidate profile**. The flow is `loadAdminCandidateProfile(userId)` →
`mapCandidateProfileToDocumentData(profile, "resume")` →
`buildDomesticResumeModel(mapping, design)` → `renderPdfDownloadResponse`.
The domestic builder is pure and does not query Supabase or write a second
candidate-data copy. The existing server-only loader resolves the client
profile from its provisioned `user_roles` link after an active-admin check.
No migration, new font, external service, or persisted PDF is required.

## Design directions

| Output | Composition and intended use |
| --- | --- |
| Domestic Resume 1 — Executive Classic | Restrained single-column nameplate, horizontal rule and ruled section headings; conventional management/operations/finance presentation. |
| Domestic Resume 2 — Modern Professional | Dark corporate identity band, left-accented headings and date-aligned structured entries; contemporary business presentation. |
| Domestic Resume 3 — Compact High-Density | Smaller but legible type, tighter margins and spacing, uppercase hierarchy and compact skills line; experienced candidates with substantial detail. |
| Domestic Resume 4 — Contemporary Sidebar | A bounded first-page two-zone profile: contact, skills and languages beside summary/certifications; employment, education, projects and additional sections continue full width. The sidebar does not repeat or detach on later pages. |
| Domestic Resume 5 — Premium Minimal | Large identity treatment, generous margins/white space and restrained chronological entries; senior corporate presentation without decorative graphics. |

`DOMESTIC_DESIGNS` contains the five fixed IDs, names and descriptions.
Each builder chooses its own section composition and PDF theme override. A
small set of shared date, field, entry and omission helpers prevents divergent
facts; the designs are not merely one layout recolored. Only the approved
bundled licensed PDF fonts are used. The neutral/dark accents are restrained
and no rating dots, progress bars, photos or inferred skills are added.

## Shared mapping and omission rules

All designs preserve candidate-supplied name, email, mobile, optional WhatsApp,
LinkedIn and location, summary, employment, education, skills,
certifications, projects, languages and additional sections. Child order is
the mapper's `(sortOrder, id)` order. The first three and fifth designs use the
usual section sequence; Design 4 presents secondary sections in its bounded
two-zone profile before the full-width career history. **Within every section,
candidate order is unchanged.**

Employment includes title, employer, optional location, explicit dates,
description and supplied highlight bullets. A stored current-role flag shows
“Present” without an invented end month. Education preserves institution,
qualification, specialization/location, exact `YYYY-MM` display or year-only
completion, result and supplied highlights. Certifications keep explicit
issue/expiry dates or years and credential details only when supplied.
Projects, languages (including supplied proficiency), and additional items
remain candidate-supplied. Absent sections and blank optional fields vanish;
there are no empty headings, “N/A” values, guessed metrics, or fabricated
achievements. A long LinkedIn URL is displayed in short plain-text lines;
joining those lines retains the original URL characters.

The domestic builder rejects mapper errors and packages without the existing
`domestic` resume-format entitlement. It does not silently grant a GCC-only or
EU-only client a domestic output. Package definitions are reused from the
frozen V1 catalog, not duplicated in the templates.

## Page flow, filenames and security

All PDFs use A4, selectable text and the existing common renderer. Section
headings reserve room for following content. Brief structured entries stay
together where safe; long entries and bullets may flow across page boundaries.
No design hard-codes a page count. Design 4 limits its two-zone composition to
the profile introduction and returns to full-width career sections, avoiding a
repeating sidebar that would detach from later-page content. The stress
fixture generated **5 / 5 / 4 / 4 / 6 pages** for Designs 1–5 respectively in
the tested renderer/runtime. The minimal fixture renders to one page and the
normal fixture to two pages in each design; these are QA observations, not
fixed limits imposed by the builders.

The protected admin route `/admin/clients/[userId]/domestic-resumes` offers
five known design IDs. Its POST `/download` route rechecks active admin access,
reloads the linked canonical profile, checks the domestic package entitlement,
rejects unknown design IDs and mismatched origins, and ignores browser-sent
candidate facts. The existing private, no-store download helper produces
`<Candidate_Name>_Domestic_Resume_<1–5>.pdf`; the filename sanitizer preserves
that suffix even for a long name. No public PDF URL, storage path or service
key reaches browser code.

The existing unlinked `/admin/pdf-render-test` harness also offers five
admin-only downloads from one static fictional long profile. It is for visual
comparison and does not load or persist a real candidate. The production
client account editor links to the per-client screen; the QA route is absent
from normal navigation.

## QA and limitations

`tests/doc-05-09-domestic-resumes.test.mjs` covers each design with minimal,
normal and long fictional profiles. PDF.js checks validity, selectable text,
required and optional sections, exact year/month presentation, source order,
bullets, A4 bounds, same-line overlap, safe names and distinct model/theme/PDF
outputs. Route tests exercise signed-out/client denial at the role boundary,
known design validation, package refusal, canonical reload, posted-data
tampering and private response headers. These are automated structural checks,
not a visual certification.

Manual review remains necessary in a PDF viewer, especially for Design 4's
first-page two-zone composition, unusually long unbroken text, complex Indic
shaping, accessibility reading order and printer differences. The designs are
text-based but are not presented as universally ATS-compatible; the separate
Global ATS Resume remains the simpler ATS-oriented output. DOC-10 GCC,
DOC-11 European/Europass and cover letters are not included here.
