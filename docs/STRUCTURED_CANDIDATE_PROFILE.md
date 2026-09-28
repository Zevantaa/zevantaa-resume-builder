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
profile/auth ownership linkage remain unchanged. The current `/client/profile`
intake edits contact/location and uploads only; it does not yet edit these
structured resume sections.

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
  precede start when both are supplied. A year-only source should remain
  unrepresented as a month until the candidate confirms the month; do not invent
  `-01` or another placeholder month.
- Skills store a name, optional category, and order. This supports ATS keywords
  and display without inventing an unverified proficiency/scoring taxonomy.
- Certifications store name, issuer, optional `YYYY-MM` issue/expiry months,
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
formalize employment semantics. Apply it through the normal Supabase migration
workflow before any code writes `grade_result`; it was not applied to the remote
project by this repository change. Existing seeded rows were checked for the
new month rules before authoring the migration.
