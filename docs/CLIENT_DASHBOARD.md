# Client dashboard (DSH-02)

The protected `/client` landing page retains the Zevantaa masthead, horizontal navigation, and module-first workspace. It shows an identity welcome, the assigned package, a deterministic profile status, current upload evidence, the internal indicative ATS score, and package-entitled document outputs. `/client/documents` and `/client/cover-letters` show the same package-filtered output states. These screens do not create documents.

## Source of truth and status rules

- `getClientDashboardSummary()` and `getClientDashboardEvidence()` resolve the authenticated active client's `user_roles.candidate_profile_id` server-side. No browser-supplied profile ID is used. The package label and output set come from the canonical DSH-01 routing catalog; unknown or mismatched package data produces no entitlement.
- **Profile setup incomplete:** no available current source resume. **Resume under review:** current source resume exists but has no `profile_resume_reviews` confirmation for that exact file. **Profile reviewed/confirmed:** that confirmation exists, but the current canonical profile is not ready for the Global ATS score. **Ready for document generation:** current source is confirmed and the existing score service reports ready. There is no fabricated percentage. Replacing a resume changes the current file ID and returns the status to under review until that replacement is confirmed.
- Upload labels use current `file_records` metadata. Source resume shows not uploaded, uploaded/under review, or reviewed/confirmed; version number appears when greater than one. GCC photo appears only for packages with GCC output, shows uploaded/not uploaded, and is optional: its absence does not block completion.
- The ATS panel uses the existing server-calculated score unchanged: actual 0–100, target 90, a not-ready state when applicable, and “Internal optimization indicator; not a third-party ATS guarantee.” No score is submitted by the browser or persisted by this dashboard.

## Entitled, ready, and downloadable are different

`buildClientDashboardView()` lists only the stable output IDs returned by `getPackageRouting()`. An included output is **entitled** but not necessarily ready or generated. Before source review it says “Available after profile review”; after review it says “Not yet available” (or “Ready to generate” for a score-ready Global ATS profile). Only an available generated `document_records` row with a matching private PDF `file_records` row becomes “Download PDF.” The five domestic designs are distinguished by the existing deterministic filename suffix; a family value alone is insufficient to identify one design.

`GET /client/documents/[documentId]/download` is a server-only private-file proxy, not an admin generation route or public URL. It rechecks client role and active profile linkage, document ownership/status/origin/package/output, matching file ownership, private access, PDF MIME/extension/size, and a profile-scoped generated-object key. It verifies the bucket is private before download, checks PDF bytes, returns `private, no-store` and `nosniff` headers, and gives a generic unavailable response on failure. Browser-supplied profile, file, bucket, path, or candidate facts are ignored. A document generated under a previous package is not downloadable unless it matches the current assignment.

## Permitted client actions

The dashboard links to `/client/profile` for read-only name, email, mobile, WhatsApp, LinkedIn, location, relocation, and package details. The only client mutations remain source-resume upload/replacement and, for GCC-entitled packages, optional photo upload/replacement. Existing upload validation, private storage, and tamper rejection remain in place. There is no client package selector or client generation action.

## Responsive behavior and limitations

The established dashboard shell handles desktop, tablet, and mobile navigation. Overview columns collapse to one column below the desktop breakpoint; package names, filenames, output labels, status chips, and buttons wrap without horizontal overflow. Manual viewport review is still required.

At implementation time the live database had **zero available generated document records**. Admin PDF routes generate on demand and do not persist generated PDFs, so no real client download can appear until a trusted admin-side process stores an available generated document/file pair using the documented private key convention. This batch does not build that process, change the database schema, expose admin generation to clients, or introduce public storage access. The existing `file_records.purpose` enum has no generated-document value; the download gate therefore relies on the generated document record, matching private PDF metadata, and the generated-object path. A future persistence workflow should align file-purpose semantics before it begins writing generated files.
