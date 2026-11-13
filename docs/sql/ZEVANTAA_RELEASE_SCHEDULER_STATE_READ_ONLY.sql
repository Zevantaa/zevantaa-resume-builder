-- Scheduler and Vault-name state only. Decrypted secret values are never read.
select jsonb_build_object(
  'cron_jobs', coalesce((
    select jsonb_agg(jsonb_build_object(
      'jobname', jobname,
      'schedule', schedule,
      'active', active
    ) order by jobid)
    from cron.job
    where jobname = 'zevantaa-automation-worker'
  ), '[]'::jsonb),
  'required_vault_names_present', (
    select count(*) = 2
    from vault.secrets
    where name in ('zevantaa_automation_worker_url', 'zevantaa_automation_worker_token')
  ),
  'source_pending', (select count(*) from public.resume_processing_jobs where status = 'pending'),
  'source_failed', (select count(*) from public.resume_processing_jobs where status = 'failed'),
  'document_pending', (select count(*) from public.document_regeneration_jobs where status = 'pending'),
  'document_failed', (select count(*) from public.document_regeneration_jobs where status = 'failed')
) as release_snapshot;
