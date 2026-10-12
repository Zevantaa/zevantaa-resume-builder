# Platform versus Zevantaa boundaries

This is a code-ownership map, not a promise of a reusable standalone package.

| Reusable capability | Current area | Zevantaa-specific policy |
| --- | --- | --- |
| Auth/session/role guards | `src/features/authentication`, `src/lib/supabase` | Master-admin model; admin-created clients |
| Canonical profile/career editing | `src/types/client-profile.ts`, `src/features/client-portal` | Frozen intake fields, package ownership and review workflow |
| Extraction/document mapper/PDF renderer | `src/features/document-generation` | Resume families, GCC photo, Europass and cover-letter variants |
| Private file, audit and security utilities | `src/features/client-portal`, `src/lib/security` | Zevantaa event taxonomy, file purposes and routing |
| Brand settings and forms | `src/features/branding`, shared UI | Official Zevantaa assets, language and colors |

The app is intentionally coupled to its V1 schema and Supabase project model. Do not pull security checks into a generic client-side package or let templates query Supabase directly. Candidate facts come from one canonical profile and document mapper; no per-layout data copy. Keep client/admin authorization and ownership at server entry points. No architecture refactor is warranted during assurance hardening because it would increase regression risk without improving a measured control.
