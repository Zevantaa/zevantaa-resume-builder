# Premium UI/UX, performance and document upgrade plan

Status: initial audit completed on `feature/premium-uiux-document-upgrade` at base `9021723`.

## Audit findings

### Confirmed defects and reliability gaps

- Protected navigation repeats `getClaims()` and the `user_roles` lookup when both a portal layout and a page service authorize the same render. `src/features/authentication/authorization.ts` should use React request memoization only; authorization must not be persisted between requests.
- Branding can be read repeatedly by metadata, the root layout, a portal layout and the appearance page. `src/features/branding/brand-settings-service.ts` should share one request-scoped read and retain safe defaults.
- Portal routes have no `loading.tsx`, so a server navigation can appear inert while authentication and page queries run. Both portals need accessible, responsive loading feedback.
- The dashboard main target exists but has no skip link. Keyboard users must be able to bypass repeated navigation.
- Client provisioning does not send email. `welcome-message.ts` creates `mailto:` and WhatsApp draft links; delivery depends on an administrator opening and sending a draft. The full temporary password is returned to the admin UI, while draft links deliberately omit it. This explains how one channel can be used and the other omitted.
- `globals.css` is a 1,400+ line mixed foundation/feature stylesheet with repeated selectors and route-specific additions. This increases regression risk and makes global motion/interaction behavior inconsistent.

### Enhancements requiring staged approval and evidence

- Premium visual restyling, richer transitions, live document previews, regional fields and renderer redesign are enhancements rather than defect fixes.
- Nationality, visa/work status, notice period, EU competency detail and education equivalence require a separate data-model/RLS/migration review. They must not be inferred or added before that review.
- Secure automated onboarding email needs a delivery design, configured sender and operational ownership. It must use a recovery/invite flow or separately delivered one-time secret, not a plaintext password in routine email.
- Document visual upgrades require the approved November 5 source files. The supplied task attachment contains only the brief. The repository currently contains two November 4 HTML UI prototypes under `docs/reference`; no approved November 5 resume or PDF reference was verified.

## Existing architecture assessment

- UI: a sound semantic base exists in `src/components/ui` for cards, fields, tables and alerts, but page headings/actions are repeated and many feature styles are coupled in `src/app/globals.css`.
- Navigation: Next `Link` is already used. The dominant code-level latency risks are sequential/repeated server reads and the absence of route fallback UI, not a missing client router.
- Documents: all eight resumes and three cover letters map reviewed structured profile data to a shared `PdfDocumentModel`, then render with local bundled fonts through `@react-pdf/renderer`. The model supports entries, columns, banners, identity blocks, page breaks, running adornments, widow/orphan control and bounded theme overrides. This shared path must remain authoritative.
- Renderer boundaries: five domestic designs live in `domestic-resumes.ts`; Global ATS, GCC and European formats have dedicated builders; the three letter variants share `cover-letters.ts`. Visual differentiation is largely theme/block composition, so renderer primitives should be upgraded before individual templates.
- Onboarding: Supabase Auth account creation is server-only and role linkage has rollback handling. Notification output is manual-draft only; there is no email transport call in the provisioning path.

## Incremental file-level milestones

1. **Performance and shared feedback foundation**
   - Update `authorization.ts` and `brand-settings-service.ts` with request-scoped React memoization.
   - Add `components/ui/route-loading.tsx` and portal `loading.tsx` files.
   - Add shared motion/elevation tokens, loading skeletons, page-entry feedback and reduced-motion rules in `globals.css`.
   - Add keyboard skip navigation in `dashboard-shell.tsx`.
   - Cover with `tests/ui-01-premium-foundation.test.mjs` and existing security/auth suites.

2. **Measured query and rendering optimization**
   - Profile route timings in local/staging-like configuration without logging candidate data.
   - Inspect service query counts in `client-dashboard-service.ts`, `admin-directory-service.ts`, document workspace services and root/portal layouts.
   - Parallelize independent reads, reduce over-selection and remove confirmed duplicate calls. Add service-level regression tests.

3. **Shared component modernization**
   - Introduce narrowly scoped page-header, action and empty/loading-state primitives under `components/ui`.
   - Migrate login/recovery, administrator and client routes incrementally; split feature CSS only when a migrated surface is covered by tests.
   - Verify mobile/tablet layouts, focus order, contrast and reduced motion after each route family.

4. **Workflow feedback and navigation accessibility**
   - Improve mobile sidebar dismissal/focus behavior, pending buttons, upload/processing status, form validation announcements and document state messaging.
   - Preserve server actions, protected downloads and existing package rules.

5. **Document renderer foundation**
   - First ingest and inventory the approved references with checksums and an explicit format-to-reference map.
   - Extend `pdf-model.ts`, `pdf-theme.ts` and `render-pdf.ts` only for reusable, tested layout primitives demonstrated by those references.
   - Run textual, pagination, Unicode, privacy-mask and long-profile regression suites before visual template changes.

6. **Eight resume and three cover-letter upgrades**
   - Update each builder independently, using only reviewed candidate data.
   - Add deterministic fixture PDFs and visual acceptance evidence for sparse, typical and long profiles. Never force a one-page result or hardcode reference facts.

7. **Live preview assessment**
   - Prototype a read-only preview from the same mapped structured data, clearly labelling it as an approximation. Stored generated PDFs remain authoritative.
   - Do not expose private object URLs or duplicate candidate data.

8. **Regional-data decision gate**
   - Produce a field/RLS/validation/renderer impact proposal. If approved, add forward-only migrations and ownership tests before UI or generation use.

9. **Onboarding reliability**
   - Replace the manual-only email assumption with an explicitly approved sender workflow and delivery audit state.
   - Prefer invite/password-reset establishment over routine plaintext temporary-password delivery. Preserve admin-only provisioning and account-status controls.

10. **Release assurance**
    - Run the full test, lint, production build, secrets scan, dependency audit and SBOM checks.
    - Complete responsive/reduced-motion/manual PDF QA and stage-only end-to-end checks. No merge, migration or deployment occurs in this branch without separate approval.
