# DSH-07 — approved v8 application UI

`docs/reference/Zevantaa_Full_UIUX_Mockup_v8.html` is the visual and interaction reference, not a production page. The application retains its existing role guards, package routing, canonical data ownership, ATS formula/90-point benchmark, PDF builders and privacy masking. The career workspace is the main interaction change: a compact section/entry navigation, one selected repeating entry at a time, independent scrolling, and a persistent save bar. The profile remains the sole source of career facts.

## Additive career fields

The forward migration `20261010203200_dsh_07_v8_editor_and_brand_settings.sql` is **prepared, not remotely applied**. It must be reviewed and applied before the v8 career save route can be used live. The existing DSH-06 save function remains the canonical atomic writer; a service-role-only v8 wrapper invokes it, then writes only newly approved optional metadata within the same transaction. Existing profile row IDs, soft-archive behavior, audit fields, ownership checks and revision lock remain in effect.

- Work: optional `employment_type`; optional `start_date` (month). Title and employer remain required. Current role clears end month.
- Education: optional `mode_of_study`, `start_year`, `end_year`, `is_current_study`. Year-only information is preserved as a year, never converted to January. Existing qualification, institution, location, grade, month dates, highlights and completion year remain supported.
- Certifications: optional exact issue/expiry dates and optional validity status. Blank is permitted. `until-date` needs an explicit expiry date; `no-expiry` cannot coexist with one. Existing year/month dates remain canonical alternatives.
- Projects: optional `is_ongoing`; ongoing projects cannot have an end month. Existing title, role, dates, description, highlights, technologies and URL remain.

The server validates all submitted career fields, never accepts browser-supplied candidate IDs or package/contact changes, and saves only against the authenticated active client's linked profile. No candidate facts are invented. Existing admin review of extracted resume proposals is unchanged.

## Shared skill library

`skill_library` is a private reusable name index. Profile skill rows remain candidate-linked and authoritative. The migration initially imports non-archived existing skill names; later career saves add custom names. Search returns only display names, without category or popularity. `Excel`, `MS Excel` and `Microsoft Excel` normalize to `Microsoft Excel`; case, spacing and punctuation are otherwise normalized deterministically for deduplication. The server still saves explicit skill entries to the candidate profile. No AI, taxonomy inference or paid service is involved. The library has RLS enabled and no browser grants; reads and writes use a trusted server path.

## Appearance settings

Only an authorized administrator can use `/admin/appearance`. A singleton `app_brand_settings` row stores an approved accent and font choice plus optional object keys. The `zevantaa-brand-assets` bucket is private, limited to 2 MB and approved image MIME types. Uploads are checked and converted server-side; service-role credentials never enter a browser bundle. The public-safe `/branding/current/logo` and `/branding/current/mark` routes expose only the currently approved brand image, never arbitrary bucket keys. If settings or assets are unavailable, built-in official Zevantaa assets and tokens remain in use. Existing source-resume and candidate-photo storage is separate and remains private.

Apply the migration through the normal reviewed deployment workflow; this work does **not** apply it. Live verification should cover a legacy profile, optional blank values, new and existing entries, skill reuse across two clients, concurrent revision conflict, the appearance page as admin/client/signed-out, custom-logo fallback, and desktop/mobile calendar positioning. Browser visual checks at 1440×900, 1365×768, 1024px, 768px and 390px are required before sign-off; repository tests do not prove pixel-level fidelity.
