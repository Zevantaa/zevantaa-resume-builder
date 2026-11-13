# DSH-05 system controls

This document describes implemented V1 controls, not background processing or a promised document-delivery workflow.

## Generation and regeneration

Package entitlement, profile readiness, in-flight generation, a successful download, a failed request, and a verified stored PDF are distinct states. The admin generators reload the provisioned candidate's current canonical profile on the server, validate package eligibility and required content, then return a private, no-store PDF. The generation button is disabled while its request is in flight. Success means the browser received a fresh PDF and started a download; it does **not** mean a `document_records` row or private storage object was created. “Generate fresh PDF” repeats that operation against the then-current reviewed canonical data. It neither mutates the profile nor overwrites a previously stored client deliverable. Persisted versions are not managed by these generators.

The client dashboard only offers downloads for verified, available, private generated-file records belonging to the signed-in client's linked profile and current package. Entitlement or an on-demand admin download alone never creates a client download.

## Errors and empty states

User-facing request errors are grouped as: expired sign-in, permission denied, unavailable document/client, profile not ready or package not entitled, and general PDF failure. The browser never renders raw response bodies from generation routes. Upload validation returns narrow, field-specific format/size/content errors. Other upload/storage failures use a generic retry message. Unknown or cross-client document IDs yield the same “Document not available” response. No UI error should reveal internal database IDs, storage keys/buckets, credentials, or stack traces.

Admin directory distinguishes no provisioned clients from filters matching nothing. Client views explain absent source resumes, unconfirmed/current-source review, missing package entitlement, no cover-letter entitlement, and no verified stored PDFs. The admin review screen explains how to obtain a source resume; the admin document screen distinguishes zero stored PDFs from on-demand generators.

## Loading and submission

Login, client account creation/edit, and source-file save already disable their submit buttons while pending. Admin directory filters display a navigation/loading label. Each on-demand PDF control shows “Generating PDF…”, disables repeat submission, then reports success or a safe error; it shows no invented progress percentage. A later click after success generates a new transient PDF. Reloading the page resets these transient request states.

## Upload replacement

Client source resumes accept PDF/DOC/DOCX up to 10 MB; optional entitled GCC photos accept JPEG/PNG/WebP up to 5 MB. Both are validated server-side, including file signature, before private Storage or database writes. The server resolves the current user-to-profile link, creates a new version with `replaces_file_id`, then compare-and-swaps the profile's current file references. Failed saves compensate only newly created records/objects; historical files are not destructively removed. After a successful swap, the prior file record is marked `replaced` where possible and remains private for audit. A failed history-status update is surfaced as a warning.

Review confirmation is keyed to the **current source file ID**. Replacing the resume therefore requires fresh confirmation by the linked client; extracted duplicates and conflicts are presented without silently overwriting canonical profile facts. Administrators retain read-only processing evidence and support access, not a normal approval gate. An optional GCC photo replacement changes only the current photo reference after successful upload and does not grant GCC entitlement to other packages. No public Storage URL is used.

## Permission matrix

| Action | Active admin | Active linked client | Signed out / wrong role |
| --- | --- | --- | --- |
| Directory, create/edit client, package change | Allowed | Denied | Denied |
| Review/confirm extraction | Allowed | Denied | Denied |
| Resume/cover-letter generation, privacy-masked export | Allowed | Denied | Denied |
| View own dashboard/read-only administrative profile | Not treated as client | Own only | Denied |
| Upload/replace source resume | Not through client intake | Own only | Denied |
| Upload/replace GCC photo | Not through client intake | Own only, entitled package | Denied |
| Download stored generated PDF | Admin may access linked client record | Own verified private file only | Denied |

The URL's portal intent is not authorization. Server role/status checks precede privileged work. Browser-supplied profile IDs, package changes, administrative fields, file paths, and candidate facts are rejected or ignored as appropriate. The Supabase admin secret remains server-only. Private bucket metadata and object ownership are rechecked at download boundaries.

## Limitations and manual QA

There is no queue, persistent generation job/status, automatic stored-version replacement, public PDF URL, or automatic client deliverable from an admin on-demand generation. A transient Blob URL exists in the requesting browser only long enough to download the returned private PDF. Test a successful and failed generator response in the browser, repeat-click behavior, upload replacement under a live Supabase session, subsequent review status, and a cross-role/cross-client denial before release. No migration is required for these controls.
