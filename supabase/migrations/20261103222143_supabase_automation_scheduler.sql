-- Phase 4: prepare a Supabase-owned minute scheduler for the existing Vercel
-- application worker. This migration deliberately does not activate the job:
-- activation requires environment-specific encrypted Vault secrets and is a
-- production-affecting operation.
begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create function public.invoke_zevantaa_automation_worker()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'zevantaa_automation_worker_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'zevantaa_automation_worker_token';

  if v_url is null or v_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/api/internal/automation$'
      or v_token is null or length(v_token) < 32 then
    raise exception 'Automation worker Vault configuration is missing or invalid';
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object('source', 'supabase-cron'),
    timeout_milliseconds := 290000
  ) into v_request_id;
  return v_request_id;
end;
$$;

create function public.configure_zevantaa_automation_schedule()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job_id bigint;
begin
  -- Fail before changing cron state when either encrypted secret is absent.
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'zevantaa_automation_worker_url'
      and decrypted_secret ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/api/internal/automation$'
  ) or not exists (
    select 1 from vault.decrypted_secrets
    where name = 'zevantaa_automation_worker_token'
      and length(decrypted_secret) >= 32
  ) then
    raise exception 'Configure the Zevantaa automation URL and token in Vault first';
  end if;

  select cron.schedule(
    'zevantaa-automation-worker',
    '* * * * *',
    $job$select public.invoke_zevantaa_automation_worker();$job$
  ) into v_job_id;
  return v_job_id;
end;
$$;

create function public.disable_zevantaa_automation_schedule()
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select cron.unschedule('zevantaa-automation-worker');
$$;

-- These functions are operational controls for a trusted postgres operator,
-- not application RPCs. Even service_role cannot activate or invoke cron.
revoke all on function public.invoke_zevantaa_automation_worker()
  from public, anon, authenticated, service_role;
revoke all on function public.configure_zevantaa_automation_schedule()
  from public, anon, authenticated, service_role;
revoke all on function public.disable_zevantaa_automation_schedule()
  from public, anon, authenticated, service_role;

commit;
