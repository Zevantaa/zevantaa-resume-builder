# Automated source processing foundation

Phase 1 introduces a durable, private processing record for each newly linked
source resume. It does not apply a production migration or replace the
canonical candidate profile.

## Upload and queue boundary

The server validates DOC, DOCX, or PDF bytes before Storage or database writes
and calculates a SHA-256 digest. Re-uploading the current identical bytes is an
idempotent success: it creates no new object, file version, or job. A new file
record stores the digest; when the profile's authoritative
`existing_resume_file_id` changes, a database trigger inserts exactly one
`resume_processing_jobs` row in the same database transaction. An unfinished
job for a replaced source is made permanently stale.

The source object remains in `candidate-intake-private`. The processing table
has RLS enabled and no anonymous or authenticated grants. Only trusted
service-role code can claim or complete work.

## Conservative readiness gate

The existing deterministic extractor and parser are reused. Only parser
proposals backed by explicit source lines are retained. A source is eligible
for later automatic acceptance only when extraction succeeds, at least one
unambiguous employment, education, or project entry exists, and no unresolved
or ambiguous structure remains. Missing optional sections alone do not block
processing.

Encrypted, active-content, unsupported, scanned, insufficient-text, or
otherwise unreadable sources become `needs-input` with a narrow correction
message. Temporary private-source failures retry. No fact, date,
qualification, achievement, proficiency, or credential is inferred.

Full extracted text remains in memory only. The durable result stores the
source digest, extractor, page count, structured proposals, source-line
references, controlled warnings, and readiness findings. It does not store raw
resume text.

## Leases and recovery

Claims use `FOR UPDATE SKIP LOCKED`, a five-minute lease, and at most three
attempts. Expired processing leases can be reclaimed. Completion requires the
current lease token; stale workers cannot publish a result. Each invocation is
bounded to at most two jobs.

The upload Server Action schedules one best-effort request-time job after the
durable database commit. Supabase Cron can also invoke the protected Vercel
worker every minute after the explicit environment activation gate described in
`AUTOMATION_SCHEDULER_RUNBOOK.md`.

Unambiguous first-source proposals are accepted atomically. A replacement that
would merge with existing career facts becomes `needs-input`. The linked client
can confirm or correct only the stored proposals, or update the authoritative
career profile and explicitly confirm it. Both paths re-check the current
source and active client link in the database before entitled outputs are
queued.
