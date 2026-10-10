# DSH-06 — Dynamic career updates

Zevantaa's later approved request permits clients to maintain ongoing career developments directly in the portal. This supersedes the earlier *upload-only* client rule for career facts, but not the administrator's authority over identity, contact, location, relocation, or package assignment. It adds no public registration or new role.

## Field authority

| Client may edit on `/client/career-profile` | Zevantaa-managed; read-only in client portal |
| --- | --- |
| Professional summary, work experience, education, skills, certifications, languages, projects, and existing additional career sections/items | Full name, primary/login email, mobile, WhatsApp, LinkedIn, current location, relocation preference, package and target markets |

Each standard section has separate labeled controls, including relevant dates, descriptions and explicitly supplied highlights. Clients can add, edit, remove and reorder entries. The form sends no database IDs, candidate ID, package, contact fields, file paths or credentials. Page-local entry keys are resolved to the active canonical row IDs only on the trusted server, after the current client's role-to-profile link and revision are verified.

## Canonical save and audit

The client Server Action allows only a career JSON payload and revision token. A strict allowlist validates the JSON, resolves the authenticated client's linked profile, and converts each page-local key to an existing owned row or a new server-generated UUID. The service calls the **service-role-only** `apply_client_career_profile` Postgres function. That function independently checks `user_roles` for an active, linked client, locks `candidate_profiles`, compares `career_revision`, and updates only `professional_summary` plus the existing career child tables in one database transaction. It never writes administrative identity/package fields. Removed rows are soft-archived with actor and reason rather than hard-deleted. A failed statement rolls back the entire RPC.

The forward migration `20261010184016_dsh_06_dynamic_career_updates.sql` adds `career_revision` and summary provenance metadata. Triggers advance the revision when summary or child career rows change, including administrator-confirmed extracted changes. Existing `created_by_user_id` and `updated_by_user_id` track row origin and latest substantive edit; unchanged rows are not rewritten merely because the client saved another section. `professional_summary_source`, its actor, and timestamp distinguish a client-authored summary from an admin-confirmed one. Earlier rows without explicit actor metadata remain unknown rather than being retroactively labeled.

The migration was **prepared only**, not applied remotely. `/client/career-profile` needs it before live use. Review and apply this forward migration through the normal Supabase deployment workflow; never edit an applied migration. No new browser table grants or permissive RLS policies are introduced.

## Validation and stale edits

The server trims surrounding whitespace but does not paraphrase text. It checks required titles/employers/work start months; `YYYY-MM` dates and chronology; current-role/end-date consistency; education's explicit year-versus-month distinction; certification issue/expiry chronology; supplied language proficiency against the existing controlled values; HTTP(S) URLs; skill/language duplicates; reasonable character/entry limits; and blank optional rows. It does not infer achievements, metrics, technologies, credentials, CEFR levels, employers or dates. Database constraints remain a second layer.

The revision token protects the whole canonical career aggregate. The loader reads it before and after assembling the profile and retries if a concurrent write changed it. The save RPC compares it again while holding the profile row lock. A stale form receives a conflict message and must refresh; it cannot silently overwrite a newer client or admin career change. The client UI disables save on a stale result until a fresh page load.

## ATS and document recompilation

On successful save, the action reloads the persisted aggregate and revalidates client and admin dashboard paths. Existing ATS services load canonical data on every request; the 0–100 indicative score therefore reflects the new facts, with a fixed target of 90 and no score floor. The existing disclaimer remains applicable.

The Global ATS, five domestic, GCC, European, three cover-letter and privacy-masked builders already consume the common canonical loader/mapper. The **next fresh on-demand PDF** uses current saved facts without touching an older downloaded PDF or stored generated record. Privacy masking still strips direct candidate contact routes from the employer copy. No background job, automatic stored-version replacement, or client-facing generation is implied.

Replacing an uploaded DOC/DOCX/PDF remains different: it stores a new private source file and requires administrator extraction review before any extracted proposal enters canonical data. Intentional client-typed career edits enter canonical data after validation, without repeating that extraction review.

## Security and deployment checks

The client route inherits the active-client guard. The Server Action and service recheck the role and server-resolved linkage. The RPC checks the same linkage independently and is executable only by `service_role`, which remains server-side. Existing admin generators/review routes remain admin-only; browser-provided profile IDs or administrative fields fail closed. Changes are visible in existing admin canonical-profile loaders without a separate copy.

Before release, apply the migration in a controlled environment and manually test: create/edit/remove/reorder in every section; save and refresh; two-tab stale conflict; admin review racing a client save; the ATS indicator; fresh entitled PDFs and masked contact behavior; signed-out/client/admin route boundaries; and older stored PDFs remaining unchanged. The repository tests exercise validation, service mapping, document propagation, and existing regression paths, but they do not substitute for a live Postgres transaction/RLS test. No migration was applied by this batch.
