# Frozen V1 package routing

`src/features/document-generation/package-routing.ts` is the shared entitlement source for PDF builders, protected download routes, and package-aware UI. It derives resume outputs from the seven frozen definitions in `src/types/package.ts`. These definitions match the currently applied `public.package_definitions` rows in Supabase (seven active codes, the same markets, families, and ordering); no database migration is needed. The stable output IDs are the existing `PdfOutputKind` values.

| Package (code) | Global ATS | Domestic 1–5 | GCC | Europass/EU | General Corporate | International Relocation | Technology & Startup | ATS score | GCC photo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Indian Domestic (`indian-domestic`) | Yes | Yes | No | No | No | No | No | Yes | No |
| GCC/Middle East (`gcc-middle-east`) | Yes | No | Yes | No | No | No | No | Yes | Yes |
| Europass/EU (`europass-european-union`) | Yes | No | No | Yes | No | No | No | Yes | No |
| Domestic + GCC (`domestic-gcc`) | Yes | Yes | Yes | No | No | No | No | Yes | Yes |
| Domestic + Europass/EU (`domestic-europass-european-union`) | Yes | Yes | No | Yes | No | No | No | Yes | No |
| Domestic + GCC + Europass (`global-mobility-master`) | Yes | Yes | Yes | Yes | No | No | No | Yes | Yes |
| Executive All-Inclusive (`executive-transition-agency-distribution`) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

The database-compatible codes and display names are retained. The Global ATS family is declared for every frozen package in both code and database. Only Executive All-Inclusive receives the three cover letters: the frozen scope explicitly includes all outputs for that package, while the other six have no cover-letter configuration reference. This conservative entitlement is not a statement that every package is ready to generate a letter.

`getPackageRouting`, `getAllowedOutputsForPackage`, `getUnavailableOutputsForPackage`, `packageAllowsOutput`, `isAtsScoreVisible`, and `isGccPhotoAvailable` fail closed for null, malformed, unknown, or inactive package values. The UI uses these helpers for visibility; package availability is distinct from profile readiness and from already-generated document state. Protected download routes reload the reviewed candidate profile on the server, enforce admin access, validate same-origin requests, and check package entitlement before rendering. The document builders independently check the same entitlement, so UI hiding is never the authorization boundary.

The ATS score remains an internal indicative 0–100 value with target 90, not a score floor or third-party guarantee. Score mathematics is unchanged. The optional GCC photograph is displayed for upload and accepted by the save service only when the assigned package includes the GCC resume. Storage remains private; package routing does not expose files.

Known limitations: the static catalog is the deploy-time routing source, so changes to database `is_active` or package-family data must be accompanied by a reviewed catalog/code update before deployment. Client dashboard output rows are visibility placeholders, not generation/download controls; DSH-02 is not implemented here.
