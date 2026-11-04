# Automated document orchestration

Reviewed canonical profiles enqueue every output allowed by the frozen V1 package matrix. Executive All-Inclusive enqueues exactly eight resume formats and three cover letters; the separate employer-masked export remains an administrator-only derivative and is not counted as a client entitlement.

The existing durable generation engine remains authoritative. Workers claim at most two jobs, use three-minute expiring leases, retry at controlled intervals, verify private PDF bytes after upload, and publish a new current version atomically. Unique job and document indexes prevent duplicate work and duplicate current versions.

Package changes are reconciled in the database transaction:

- newly entitled outputs are enqueued at the current career revision;
- unfinished work that is no longer entitled becomes terminal with `no-longer-entitled`;
- no-longer-entitled current documents become `outdated`, so clients cannot download them;
- document and file history is retained for authorized administrator review;
- re-entitlement resets the matching job safely when a current document is absent.

The global claim function only selects jobs for an active linked client and returns that client as the provenance actor. Browser roles have no direct access to the queue or orchestration functions.
