# Automation scheduler runbook

## Decision

Use Supabase Cron in Zevantaa project `fzltowzpfrnuxxxrzuih` to invoke the Zevantaa Vercel application route `POST /api/internal/automation` every minute.

This preserves the existing Node/PDF generation engine on Vercel while keeping scheduling and queue state in Zevantaa-owned Supabase. Vercel Cron is not the primary scheduler because its Hobby schedule is limited to once daily and failed invocations are not retried. The application queues remain the retry and idempotency boundary regardless of HTTP invocation failure.

The endpoint claims at most one source-processing job and one document-generation job per invocation. Database `FOR UPDATE SKIP LOCKED` claims, expiring leases, attempt limits, delayed retries, revision checks, unique job keys, read-back verification and atomic publication make overlapping or missed invocations safe.

## Activation gate

Do not perform these steps from a feature branch or without explicit production authorization.

1. Apply all reviewed migrations to the intended staging or production Supabase project.
2. Generate an independent random bearer value of at least 32 characters. Store it in Vercel as server-only `AUTOMATION_WORKER_SECRET` for the matching environment.
3. In Supabase Vault, create or update these encrypted, uniquely named secrets:
   - `zevantaa_automation_worker_url`: the clean HTTPS URL ending exactly in `/api/internal/automation` for that environment.
   - `zevantaa_automation_worker_token`: the exact bearer value configured in Vercel.
4. From the trusted Supabase SQL editor as the database owner, run:

   `select public.configure_zevantaa_automation_schedule();`

5. Verify one successful entry in `cron.job_run_details`, a successful `net` response, and bounded queue progress without candidate content in logs.

To stop new invocations without altering queue or document data, run `select public.disable_zevantaa_automation_schedule();` as the database owner. Existing leased jobs remain recoverable after lease expiry.

Vault and Vercel must use separate values per staging and production. Never paste either value into source control, tickets, logs, request bodies, or browser-visible variables.
