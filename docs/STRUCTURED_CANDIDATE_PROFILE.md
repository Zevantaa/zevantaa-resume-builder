# Canonical structured candidate profile (DOC-01-01–05)

The FND-03 `public.candidate_profiles` row and its existing `profile_*` child rows
are the **only authoritative resume-data model**. The matching application
aggregate is `CandidateProfile` in `src/types/client-profile.ts`; its child
interfaces map to those tables. Extraction, later editing, ATS analysis, Global
ATS/domestic/GCC/Europass-style resume layouts, and cover letters must use this
same candidate-supplied data. No layout-specific candidate copies or inferred
qualifications/achievements are permitted.

| Concern | Database source | TypeScript member |
| --- | --- | --- |
| Identity/contact and professional summary | `candidate_profiles` | `CandidateProfile` contact fields, `professionalSummary` |
| Package and target markets | `candidate_profiles.selected_package_code`, `target_markets`; `package_definitions` | `selectedPackage`, `targetMarkets` |
| Employment | `profile_work_experiences` | `workExperience: WorkExperienceEntry[]` |
| Education | `profile_education_entries` | `education: EducationEntry[]` |
| Skills | `profile_skills` | `skills: SkillEntry[]` |
| Certifications | `profile_certifications` | `certifications: CertificationEntry[]` |
| Languages | `profile_languages` | `languages` |
| Projects | `profile_projects` | `projects` |
| Other candidate-supplied sections | `additional_profile_sections`, `additional_profile_section_items` | `additionalSections` |

Each child has a stable UUID, `candidate_profile_id` foreign key, nonnegative
`sort_order`, audit timestamps/actor fields, and archive metadata. Fetch active
items in `(sort_order, id)` order for deterministic display; equal sort orders
are allowed so existing data can be reordered without a uniqueness conflict.
All child foreign keys restrict physical profile deletion. Existing RLS and
profile/auth ownership linkage remain unchanged. The `/client/profile`
intake shows administratively managed core fields read-only and permits only
source-resume and optional GCC-photo uploads. The separate protected
`/client/career-profile` route edits these canonical structured career sections
under the DSH-06 permission boundary; see `docs/DYNAMIC_CAREER_UPDATES.md`.
New admin-created profiles may have no source resume
until their first client upload, so `existingResume` is optional in the
TypeScript aggregate.

## Section semantics

- Employment stores employer, title, location, `YYYY-MM` start/end, current-role
  flag, and order. `description` is candidate-provided role narrative or
  responsibilities; `highlights[]` is candidate-provided achievement bullets.
  This existing distinction is sufficient; a second achievements table/column
  would duplicate data. A current role must have no end month. When both months
  exist, end cannot precede start.
- Education stores institution, qualification, optional field/specialization,
  location, `YYYY-MM` dates, optional candidate-supplied `grade_result`, and
  highlights. `grade_result` is the one new content field needed to preserve a
  result distinctly without hiding it in free-text highlights. End month cannot
  precede start when both are supplied. DOC-02 live QA added optional
  `completion_year` for an explicitly stated year-only completion; do not invent
  `-01` or another placeholder month.
- Skills store a name, optional category, and order. This supports ATS keywords
  and display without inventing an unverified proficiency/scoring taxonomy.
- Certifications store name, issuer, optional `YYYY-MM` issue/expiry months,
  optional exact `issue_year`/`expiry_year` where only a year was stated,
  optional credential ID/URL, and order. Expiry cannot precede issue when both
  are supplied. No expiry or credential identifier is fabricated.

All optional source fields remain nullable/optional; an absent item is not
generated merely because a resume layout has a slot for it. `YearMonth` in
TypeScript represents `YYYY-MM`; the DOC-01 migration adds database checks for
valid month syntax and chronology in employment, education, and certifications.
It does not change existing columns or records. Employment's pre-existing
current-role/end-date check remains authoritative.

## Reuse and migration

Reused unchanged: the FND-03 parent/child tables, package catalog, file/document
references, profile ownership, child foreign keys, sort indexes, audit/archive
fields, and RLS. The only new migration is
`20260928000100_doc_01_01_05_profile_model_integrity.sql`: one nullable
education result column, three month/chronology checks, and comments that
formalize employment semantics. The existing remote Supabase project has this
DOC-01 migration applied (verified by migration history and the `grade_result`
column); this DOC-01-06–08 batch adds no migration. Existing seeded rows were
checked for the month rules before that migration was authored.

## Summary and document-domain mapping (DOC-01-06–07)

`candidate_profiles.professional_summary` / `CandidateProfile.professionalSummary`
is the **one canonical candidate-supplied summary**. It is optional. The
document-domain projection marks a present summary as `candidate-supplied` and
retains its exact text, source profile ID, and profile update timestamp. It does
not generate or store a rewritten summary. Any future rewritten wording belongs
to a separate versioned generated document, with traceability to the original;
it must never overwrite the candidate's source profile.

`mapCandidateProfileToDocumentData` in
`src/features/document-generation/profile-mapper.ts` accepts the reviewed
`CandidateProfile` aggregate and an output purpose (`resume` or `cover-letter`).
It returns a **transient** `DocumentData` projection, structured findings, and
`canGenerate`. It neither loads database rows nor writes data. A future trusted
loader must assemble only the authorized profile and its active child rows;
passing an unreviewed upload directly to this mapper would violate the data
rule. No template-specific database copy is created.

| Source | Document-domain destination | Rule |
| --- | --- | --- |
| Contact fields | `identity` | Preserve supplied text; omit blank optional email, mobile, WhatsApp, LinkedIn, and location |
| `professionalSummary` | `professionalSummary.text` | Preserve exact candidate text; omit if blank; mark source |
| `workExperience` | `employment` | Sort by `(sortOrder, id)`; preserve responsibilities and achievement bullets separately |
| `education` | `education` | Sort identically; omit absent result/grade rather than invent one |
| `skills` | `skills` | Sort identically; preserve names and optional categories |
| `certifications` | `certifications` | Sort identically; omit absent dates/credential fields |
| `languages`, `projects` | Same-named sections | Sort identically; omit blank optional details |
| `additionalSections` and nested items | `additionalSections` | Sort both levels; omit empty items and empty sections |
| `selectedPackage`, `targetMarkets` | `packageContext` | Carry the selected context without inferring extra entitlements |
| `gccPhoto` | `gccPhotoFileId` | Carry only private file ID; no public URL or storage object path |

All eight V1 resume layouts and three V1 cover-letter formats should consume
this same mapped data when implemented later. The mapper does **not** render a
layout, grant package entitlements, perform privacy masking, or generate files.

## Incomplete-data policy (DOC-01-08)

The mapper omits absent optional sections and blank bullets, so later renderers
must create a heading only when the corresponding mapped section exists.
Current employment retains `currentRole: true` and omits its end date; a later
renderer may display “Present” from that explicit status. If a conflicting end
date appears in an in-memory record, the mapper omits it and returns a warning.
Missing GCC photo is allowed, including for non-GCC output; its absence must
not produce a public fallback image. Missing LinkedIn, WhatsApp, education
result, certification dates/URL, or other optional values produce no placeholder.
Incomplete child items with missing required labels are omitted with a warning.

Findings have stable `code`, `severity` (`warning` or `error`), `path`, and a
safe message. Errors block `canGenerate`: missing full name, primary email,
mobile number, package or target market; a resume with no structured career
section; or a cover letter with neither summary nor structured career context.
Missing required contact values are omitted and block output, not fabricated. For
example, an absent education result is simply omitted; an absent full name
returns `missing_full_name` and blocks output. Additional document-specific
requirements may be added only when their V1 output needs them, not inferred
from a template's empty space.

No fallback employer, role, degree, certification, date, metric, achievement,
skill, or prose is generated by this mapper. Nonblank candidate text is passed
through unchanged. This is a data-mapping/readiness layer only, not DOC-02
extraction or document generation. No migration or RLS change is needed for
DOC-01-06–08.
