# DOC-13 — Persistent Document Delivery & Career Regeneration

## Architecture audit

The current admin generator routes render and return PDF bytes without persisting them. The existing `file_records` and `document_records` tables support private file references and generated-document metadata, but the file-purpose and output identity fields do not yet represent the eleven distinct candidate-facing outputs or a separate employer-masked output. Existing client/admin stored-document readers therefore have no normal generation path to populate their views and currently expect the intake bucket. This work will extend those records and use a dedicated private generated-document bucket; it will not create a parallel candidate profile.

## Production path

Protected admin route → linked candidate loaded on the server → canonical mapper → output-specific model → common PDF renderer → signature/trailer and 10 MB check → private Storage upload → read-back SHA-256 verification → atomic database publication → PDF response. Browser fields never supply candidate facts or object keys. The fictional admin QA PDFs remain transient, not candidate deliverables.

The two migrations were applied remotely in order as `20261023190731_doc_13_persistent_documents` and `20261023190738_doc_13_document_lifecycle`. Their recorded SQL bodies exactly match the local files `20261019064514_doc_13_persistent_documents.sql` and `20261019064608_doc_13_document_lifecycle.sql`, respectively, apart from each local file's trailing newline. PostgreSQL requires the enum-label additions to commit before the second migration uses them. Live Storage and document-generation QA remains required before release.

## Storage and records

`candidate-documents-private` is a dedicated private, PDF-only 10 MB bucket. No anon/authenticated Storage policy is added. Server-generated objects use `<candidate-profile UUID>/<document UUID>/<file UUID>.pdf`; only trusted server code holds the service-role key. Source resumes/photos retain their separate intake bucket. No public or signed URL is issued for generated files.

`file_records.purpose = generated-document` supports these PDFs. `document_records.output_kind` separately identifies Global ATS, Domestic 1–5, GCC, EU, three cover letters, and the employer-masked Global ATS export. Identity is never inferred from filenames. `source_career_revision` records the profile snapshot. Legacy generated rows with null output identity are **not guessed or backfilled**; they need reviewed reconciliation.

The `(candidate_profile_id, output_kind)` partial unique index permits at most one unarchived `available` version. A second unique index protects version numbers. The publication RPC locks the candidate, rechecks package and revision, validates key/filename/lease metadata, calculates next version, supersedes the prior current record, and inserts linked file/document records in one PostgreSQL transaction. File v2+ references the previous file. Masked PDFs have a separate output identity and source-document relationship, and cannot become the normal Global ATS current PDF.

## Library and authorization

The client library is rebuilt from database records on every request/new session. It shows only unmasked, package-entitled, `available` PDFs whose source career revision equals the current profile revision, with name, version, generated date and server-mediated download. Old versions remain admin-visible, not client-current. Admin can see current, superseded and outdated versions, including masked copies. Client downloads re-resolve the authenticated user's profile; admin downloads recheck the selected provisioned client. Both validate the document/file relationship, private bucket and exact opaque key before server-side download. A document UUID or object key alone grants nothing.

## Lifecycle and compensation

`available` means current published; `superseded` means replaced; `outdated` means career facts changed. Pending/processing/failed regeneration lives in `document_regeneration_jobs`, not as a downloadable partial document. If render/upload/read-back fails, the old current stays untouched. Storage and Postgres cannot share a transaction: a rejected publication prompts deletion of the unreferenced private object. On an ambiguous RPC response, the service checks by generated document/file UUID before deletion; an inconclusive check retains a private object for operator reconciliation rather than risking deletion of a committed PDF. Cleanup failures are surfaced. No failed PDF is marked current.

## Career revision and jobs

The existing career-save RPC increments `career_revision` only on a successful save. A database trigger marks generated current PDFs outdated and enqueues one job per previously current, unmasked output still entitled under the selected active package. It leaves uploaded source resumes alone. `(candidate, output, revision)` is unique. Claims use `FOR UPDATE SKIP LOCKED`, a three-minute lease token and at most three attempts. Publication rechecks lease, revision and package, preventing duplicate/stale workers from creating a second current version.

The save RPC may update multiple career child rows, advancing `career_revision` more than once inside its transaction. The trigger carries pending/processing/failed jobs forward to the latest revision and reuses the most recent outdated output identity, so the queue does not get stranded at an intermediate revision. An in-flight worker with an old lease cannot publish after the revision changes.

The Next.js career-save Server Action schedules **one bounded job** through `after()`. Authorized client document-library visits schedule another bounded job. Jobs are durable and can be pending, processing, completed or failed. Failed jobs get a non-sensitive code and delayed retry; the UI says Updating or Update failed without presenting an obsolete PDF as current.

The prepared unattended path uses Zevantaa Supabase Cron to invoke the protected Zevantaa Vercel `POST /api/internal/automation` route every minute. Each invocation claims at most one source job and one document job, so concurrency stays bounded while repeated invocations drain the durable queues. Request-time kicks are latency optimizations only. The schedule is deliberately not activated by this feature branch: migration rollout, separate Vercel/Vault secrets, owner activation and live recovery evidence remain release gates described in `AUTOMATION_SCHEDULER_RUNBOOK.md`.

## Security and live QA

The job table has RLS and no browser grants. Claim/fail/publication RPCs use an empty search path and explicit service-role EXECUTE grants. Production generation remains admin-only, package-gated, rate-limited and audited on success. PDF contents and candidate CV text are not logged. Masked exports are admin-only and never included in client library queries.

After migration application, manual Supabase QA is still required for bucket privileges, SQL function behavior, private read-back, all eleven package outputs, masked lineage, version/current uniqueness, admin/client new-session downloads, career-save invalidation, scheduler authentication, lease recovery and interrupted-job retry. Local mocks do not prove live Storage, Cron delivery or end-to-end document generation. Legacy null-output records need a reviewed disposition; operational orphan reconciliation and explicit scheduler activation remain release gates.
