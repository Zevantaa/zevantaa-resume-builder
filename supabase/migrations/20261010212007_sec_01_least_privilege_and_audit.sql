-- SEC-01. Prepared only: review and apply through the normal migration process.
-- The application uses service_role exclusively for protected profile/storage
-- operations. Authenticated users need only their own user_roles SELECT policy.
begin;

-- The event trigger invokes this function internally; the application never
-- needs direct EXECUTE, including through its service-role client.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated, service_role;
  end if;
end
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.user_roles to authenticated;

create index if not exists profile_resume_reviews_confirmed_by_user_idx
  on public.profile_resume_reviews (confirmed_by_user_id);

-- Fixed-window counters are atomic across application instances. Only the
-- trusted server can consume a counter; no raw email or IP address is stored.
create table public.security_rate_limit_counters (
  scope text not null check (scope in ('recovery-callback','password-update',
    'client-provision','client-edit','career-save','resume-upload','photo-upload',
    'brand-upload','pdf-generation','resume-review')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (scope, subject_hash, window_start)
);
alter table public.security_rate_limit_counters enable row level security;
revoke all on public.security_rate_limit_counters from public, anon, authenticated;
grant select, insert, update on public.security_rate_limit_counters to service_role;

create function public.consume_application_rate_limit(
  p_scope text, p_subject_hash text, p_window_seconds integer, p_limit integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_count integer; v_window timestamptz;
begin
  if p_scope not in ('recovery-callback','password-update','client-provision',
    'client-edit','career-save','resume-upload','photo-upload','brand-upload',
    'pdf-generation','resume-review')
    or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_window_seconds not between 60 and 86400
    or p_limit not between 1 and 100
  then raise exception 'Invalid rate-limit request'; end if;
  v_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  insert into public.security_rate_limit_counters (scope,subject_hash,window_start,request_count)
  values (p_scope,p_subject_hash,v_window,1)
  on conflict (scope,subject_hash,window_start) do update
    set request_count=public.security_rate_limit_counters.request_count+1
  returning request_count into v_count;
  return v_count <= p_limit;
end $$;
revoke all on function public.consume_application_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_application_rate_limit(text,text,integer,integer)
  to service_role;

-- This is an event record, not a copy of candidate content. The application
-- inserts only allowlisted status/IDs and small metadata; privileged DB owners
-- retain the ability to alter rows, so immutability is not claimed.
create table public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'client.account.created','client.account.updated','client.account.disabled',
    'client.account.reactivated','client.career.saved','client.resume.replaced',
    'client.photo.replaced','resume.review.confirmed','document.generated',
    'document.privacy_generated','brand.settings.changed','recovery.password.updated'
  )),
  actor_user_id uuid,
  target_user_id uuid,
  candidate_profile_id uuid,
  outcome text not null check (outcome in ('success','denied','failed')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048),
  created_at timestamptz not null default now()
);
alter table public.security_audit_events enable row level security;
revoke all on public.security_audit_events from public, anon, authenticated;
grant insert, select on public.security_audit_events to service_role;
create index security_audit_events_actor_time_idx
  on public.security_audit_events (actor_user_id, created_at desc);
create index security_audit_events_profile_time_idx
  on public.security_audit_events (candidate_profile_id, created_at desc);

commit;
