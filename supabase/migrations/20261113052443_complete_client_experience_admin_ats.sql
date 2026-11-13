-- Additive client lifecycle controls and document-linked ATS provenance.
-- Existing users, roles, profiles, files, documents and historic ATS snapshots
-- are preserved. Browser roles receive no direct access to the new tables.
begin;

-- Browser-role privileges are already revoked and protected data access is
-- server-side. Enable RLS on every remaining legacy application table as
-- defense in depth without adding browser policies or changing service-role
-- behavior.
alter table public.additional_profile_section_items enable row level security;
alter table public.additional_profile_sections enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.document_records enable row level security;
alter table public.file_records enable row level security;
alter table public.package_definitions enable row level security;
alter table public.profile_certifications enable row level security;
alter table public.profile_education_entries enable row level security;
alter table public.profile_languages enable row level security;
alter table public.profile_projects enable row level security;
alter table public.profile_skills enable row level security;
alter table public.profile_work_experiences enable row level security;

alter table public.candidate_profiles
  add column client_recovery_until timestamptz,
  add constraint candidate_profiles_client_recovery_check check (
    (archived_at is null and client_recovery_until is null)
    or (archived_at is not null and client_recovery_until is not null
      and client_recovery_until > archived_at)
  ) not valid;

create table public.client_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  auth_user_id uuid,
  actor_user_id uuid not null,
  action text not null check (action in (
    'archive','restore','permanent-delete-requested','permanent-delete-completed'
  )),
  outcome text not null check (outcome in ('success','failed')),
  error_code text check (
    error_code is null or error_code ~ '^[a-z0-9-]{1,80}$'
  ),
  created_at timestamptz not null default now()
);
create index client_lifecycle_events_profile_time_idx
  on public.client_lifecycle_events (candidate_profile_id, created_at desc);
alter table public.client_lifecycle_events enable row level security;
revoke all on public.client_lifecycle_events from public, anon, authenticated;
grant select, insert on public.client_lifecycle_events to service_role;

create table public.client_permanent_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  auth_user_id uuid not null,
  requested_by_user_id uuid not null,
  confirmation_identifier_sha256 text not null
    check (confirmation_identifier_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-z0-9-]{1,80}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (candidate_profile_id),
  constraint client_permanent_deletion_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);
alter table public.client_permanent_deletion_requests enable row level security;
revoke all on public.client_permanent_deletion_requests from public, anon, authenticated;
grant select, insert, update on public.client_permanent_deletion_requests to service_role;

create table public.document_ats_assessments (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null
    references public.candidate_profiles(id) on delete restrict,
  source_kind text not null check (source_kind in ('original','generated')),
  source_file_id uuid not null,
  document_record_id uuid,
  output_kind public.generated_output_kind,
  document_version integer check (document_version is null or document_version > 0),
  algorithm_version text not null default 'zevantaa-document-ats-v1'
    check (algorithm_version = 'zevantaa-document-ats-v1'),
  status text not null default 'pending'
    check (status in ('pending','processing','ready','unavailable','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  overall_score integer check (overall_score is null or overall_score between 0 and 100),
  breakdown jsonb,
  findings jsonb not null default '[]'::jsonb check (
    jsonb_typeof(findings) = 'array' and pg_column_size(findings) <= 131072
  ),
  assessed_at timestamptz,
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-z0-9-]{1,80}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_ats_assessments_file_fk
    foreign key (candidate_profile_id, source_file_id)
    references public.file_records(candidate_profile_id, id) on delete restrict,
  constraint document_ats_assessments_document_fk
    foreign key (candidate_profile_id, document_record_id)
    references public.document_records(candidate_profile_id, id) on delete restrict,
  constraint document_ats_assessments_source_check check (
    (source_kind = 'original' and document_record_id is null
      and output_kind is null and document_version is null)
    or (source_kind = 'generated' and document_record_id is not null
      and output_kind is not null and document_version is not null)
  ),
  constraint document_ats_assessments_resume_output_check check (
    source_kind = 'original' or output_kind in (
      'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
      'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5',
      'gcc-resume', 'europass-eu-resume'
    )
  ),
  constraint document_ats_assessments_lease_check check (
    (status = 'processing' and lease_token is not null and lease_until is not null)
    or (status <> 'processing' and lease_token is null and lease_until is null)
  ),
  constraint document_ats_assessments_result_check check (
    (status = 'ready' and overall_score is not null and breakdown is not null
      and jsonb_typeof(breakdown) = 'array' and jsonb_array_length(breakdown) = 8
      and pg_column_size(breakdown) <= 32768 and assessed_at is not null)
    or (status = 'unavailable' and overall_score is null and breakdown is null
      and assessed_at is not null)
    or (status in ('pending','processing','failed') and overall_score is null
      and breakdown is null and assessed_at is null)
  ),
  unique (source_file_id, algorithm_version)
);
create index document_ats_assessments_claim_idx
  on public.document_ats_assessments (next_attempt_at, created_at, id)
  where status in ('pending','processing','failed') and attempts < 3;
create index document_ats_assessments_profile_idx
  on public.document_ats_assessments
    (candidate_profile_id, source_kind, assessed_at desc);
alter table public.document_ats_assessments enable row level security;
revoke all on public.document_ats_assessments from public, anon, authenticated;
grant select, insert, update, delete on public.document_ats_assessments to service_role;

create function public.enqueue_document_ats_assessment_for_file()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.purpose = 'source-resume' and new.status = 'available'
      and new.archived_at is null and new.storage_bucket_name = 'candidate-intake-private'
      and new.storage_object_key is not null then
    insert into public.document_ats_assessments
      (candidate_profile_id, source_kind, source_file_id)
    values (new.candidate_profile_id, 'original', new.id)
    on conflict (source_file_id, algorithm_version) do nothing;
  end if;
  return new;
end;
$$;
create trigger file_records_enqueue_document_ats_assessment
after insert or update of status on public.file_records
for each row execute function public.enqueue_document_ats_assessment_for_file();

create function public.enqueue_document_ats_assessment_for_generated()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.origin = 'generated' and new.status = 'available'
      and new.file_record_id is not null and new.output_kind is not null
      and new.output_kind in (
        'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
        'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5',
        'gcc-resume', 'europass-eu-resume'
      )
      and new.archived_at is null and not new.is_privacy_masked then
    insert into public.document_ats_assessments (
      candidate_profile_id, source_kind, source_file_id, document_record_id,
      output_kind, document_version
    ) values (
      new.candidate_profile_id, 'generated', new.file_record_id, new.id,
      new.output_kind, new.version_number
    ) on conflict (source_file_id, algorithm_version) do nothing;
  end if;
  return new;
end;
$$;
create trigger document_records_enqueue_document_ats_assessment
after insert or update of status on public.document_records
for each row execute function public.enqueue_document_ats_assessment_for_generated();

-- Queue existing active source files and generated resumes without altering
-- their records or guessing scores from the structured profile.
insert into public.document_ats_assessments
  (candidate_profile_id, source_kind, source_file_id)
select f.candidate_profile_id, 'original', f.id
from public.file_records f
join public.candidate_profiles p on p.id = f.candidate_profile_id
where f.purpose = 'source-resume' and f.status = 'available'
  and f.archived_at is null and p.archived_at is null
  and f.storage_bucket_name = 'candidate-intake-private'
  and f.storage_object_key is not null
on conflict (source_file_id, algorithm_version) do nothing;

insert into public.document_ats_assessments (
  candidate_profile_id, source_kind, source_file_id, document_record_id,
  output_kind, document_version
)
select d.candidate_profile_id, 'generated', d.file_record_id, d.id,
  d.output_kind, d.version_number
from public.document_records d
join public.candidate_profiles p on p.id = d.candidate_profile_id
join public.file_records f on f.id = d.file_record_id
  and f.candidate_profile_id = d.candidate_profile_id
where d.origin = 'generated' and d.status = 'available'
  and d.file_record_id is not null and d.output_kind is not null
  and d.output_kind in (
    'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
    'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5',
    'gcc-resume', 'europass-eu-resume'
  )
  and d.archived_at is null and not d.is_privacy_masked
  and p.archived_at is null and f.archived_at is null
on conflict (source_file_id, algorithm_version) do nothing;

create function public.claim_document_ats_assessment()
returns table (
  assessment_id uuid, candidate_profile_id uuid, source_kind text,
  source_file_id uuid, document_record_id uuid, lease_token uuid
)
language plpgsql security invoker set search_path = '' as $$
begin
  update public.document_ats_assessments a
  set status = 'processing', lease_token = gen_random_uuid(),
      lease_until = now() + interval '6 minutes', attempts = a.attempts + 1,
      updated_at = now(), last_error_code = null
  where a.id = (
    select q.id from public.document_ats_assessments q
    join public.candidate_profiles p on p.id = q.candidate_profile_id
      and p.archived_at is null
    join public.user_roles r on r.candidate_profile_id = q.candidate_profile_id
      and r.role_code = 'client' and r.account_status = 'active'
    where q.attempts < 3 and q.next_attempt_at <= now()
      and (q.status in ('pending','failed')
        or (q.status = 'processing' and q.lease_until < now()))
    order by q.next_attempt_at, q.created_at, q.id
    limit 1 for update of q skip locked
  )
  returning a.id, a.candidate_profile_id, a.source_kind,
    a.source_file_id, a.document_record_id, a.lease_token
  into assessment_id, candidate_profile_id, source_kind,
    source_file_id, document_record_id, lease_token;
  if assessment_id is not null then return next; end if;
end;
$$;

create function public.complete_document_ats_assessment(
  p_assessment_id uuid, p_lease_token uuid, p_status text,
  p_score integer, p_breakdown jsonb, p_findings jsonb
)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('ready','unavailable')
      or p_findings is null or jsonb_typeof(p_findings) <> 'array'
      or pg_column_size(p_findings) > 131072
      or (p_status = 'ready' and (
        p_score not between 0 and 100 or jsonb_typeof(p_breakdown) <> 'array'
        or jsonb_array_length(p_breakdown) <> 8
        or pg_column_size(p_breakdown) > 32768
        or (select coalesce(sum((item->>'score')::integer), -1)
          from jsonb_array_elements(p_breakdown) item) <> p_score
        or (select coalesce(sum((item->>'maximum')::integer), -1)
          from jsonb_array_elements(p_breakdown) item) <> 100))
      or (p_status = 'unavailable' and (p_score is not null or p_breakdown is not null)) then
    raise exception 'Invalid document ATS assessment';
  end if;
  update public.document_ats_assessments set
    status = p_status, lease_token = null, lease_until = null,
    overall_score = p_score, breakdown = p_breakdown, findings = p_findings,
    assessed_at = now(), last_error_code = null, updated_at = now()
  where id = p_assessment_id and status = 'processing'
    and lease_token = p_lease_token and lease_until > now();
  return found;
end;
$$;

create function public.fail_document_ats_assessment(
  p_assessment_id uuid, p_lease_token uuid, p_error_code text
)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'Invalid document ATS error code';
  end if;
  update public.document_ats_assessments set
    status = 'failed', lease_token = null, lease_until = null,
    next_attempt_at = now() + interval '2 minutes',
    last_error_code = p_error_code, updated_at = now()
  where id = p_assessment_id and status = 'processing'
    and lease_token = p_lease_token;
  return found;
end;
$$;

create function public.archive_client_account(
  p_profile_id uuid, p_actor_user_id uuid, p_recovery_days integer default 30
)
returns table (auth_user_id uuid, recovery_until timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_auth_user_id uuid; v_now timestamptz := now();
begin
  if p_recovery_days < 7 or p_recovery_days > 90 or not exists (
    select 1 from public.user_roles a where a.user_id = p_actor_user_id
      and a.role_code = 'admin' and a.account_status = 'active'
  ) then raise exception 'Client archive denied'; end if;

  select r.user_id into v_auth_user_id from public.user_roles r
  join public.candidate_profiles p on p.id = r.candidate_profile_id
  where r.candidate_profile_id = p_profile_id and r.role_code = 'client'
    and p.archived_at is null for update of r, p;
  if not found then raise exception 'Active client unavailable'; end if;

  update public.candidate_profiles set archived_at = v_now,
    archived_by_user_id = p_actor_user_id, archive_reason = 'client-archived',
    client_recovery_until = v_now + make_interval(days => p_recovery_days),
    updated_at = v_now, updated_by_user_id = p_actor_user_id
  where id = p_profile_id;
  update public.user_roles set account_status = 'disabled', updated_at = v_now
    where user_id = v_auth_user_id and role_code = 'client';
  update public.client_onboarding_invitations set account_status = 'disabled',
    updated_at = v_now where candidate_profile_id = p_profile_id;
  update public.resume_processing_jobs set status = 'failed', attempts = 3,
    lease_token = null, lease_until = null, completed_at = null,
    last_error_code = 'client-archived', updated_at = v_now
    where candidate_profile_id = p_profile_id
      and status in ('pending','processing','failed');
  update public.document_regeneration_jobs set status = 'failed', attempts = 3,
    lease_token = null, lease_until = null, completed_at = null,
    last_error_code = 'client-archived', updated_at = v_now
    where candidate_profile_id = p_profile_id
      and status in ('pending','processing','failed');
  update public.document_ats_assessments set status = 'failed', attempts = 3,
    lease_token = null, lease_until = null,
    last_error_code = 'client-archived', updated_at = v_now
    where candidate_profile_id = p_profile_id
      and status in ('pending','processing','failed');
  insert into public.client_lifecycle_events
    (candidate_profile_id, auth_user_id, actor_user_id, action, outcome)
  values (p_profile_id, v_auth_user_id, p_actor_user_id, 'archive', 'success');
  auth_user_id := v_auth_user_id;
  recovery_until := v_now + make_interval(days => p_recovery_days);
  return next;
end;
$$;

create function public.restore_client_account(
  p_profile_id uuid, p_actor_user_id uuid
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_auth_user_id uuid; v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.user_roles a where a.user_id = p_actor_user_id
      and a.role_code = 'admin' and a.account_status = 'active'
  ) then raise exception 'Client restore denied'; end if;
  select r.user_id into v_auth_user_id from public.user_roles r
  join public.candidate_profiles p on p.id = r.candidate_profile_id
  where r.candidate_profile_id = p_profile_id and r.role_code = 'client'
    and p.archived_at is not null and p.client_recovery_until >= v_now
  for update of r, p;
  if not found then raise exception 'Archived client is outside recovery period'; end if;

  update public.candidate_profiles set archived_at = null,
    archived_by_user_id = null, archive_reason = null, client_recovery_until = null,
    updated_at = v_now, updated_by_user_id = p_actor_user_id
  where id = p_profile_id;
  update public.user_roles set account_status = 'active', updated_at = v_now
    where user_id = v_auth_user_id and role_code = 'client';
  update public.client_onboarding_invitations set account_status = 'active',
    updated_at = v_now where candidate_profile_id = p_profile_id;
  update public.resume_processing_jobs set status = 'pending', attempts = 0,
    next_attempt_at = v_now, last_error_code = null, updated_at = v_now
    where candidate_profile_id = p_profile_id and status = 'failed'
      and last_error_code = 'client-archived';
  update public.document_regeneration_jobs set status = 'pending', attempts = 0,
    next_attempt_at = v_now, last_error_code = null, updated_at = v_now
    where candidate_profile_id = p_profile_id and status = 'failed'
      and last_error_code = 'client-archived';
  update public.document_ats_assessments set status = 'pending', attempts = 0,
    next_attempt_at = v_now, last_error_code = null, updated_at = v_now
    where candidate_profile_id = p_profile_id and status = 'failed'
      and last_error_code = 'client-archived';
  perform public.enqueue_entitled_document_outputs(p_profile_id);
  insert into public.client_lifecycle_events
    (candidate_profile_id, auth_user_id, actor_user_id, action, outcome)
  values (p_profile_id, v_auth_user_id, p_actor_user_id, 'restore', 'success');
  return v_auth_user_id;
end;
$$;

create function public.complete_client_permanent_deletion(
  p_request_id uuid, p_profile_id uuid, p_actor_user_id uuid
)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_auth_user_id uuid; v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.user_roles a where a.user_id = p_actor_user_id
      and a.role_code = 'admin' and a.account_status = 'active'
  ) then raise exception 'Permanent deletion denied'; end if;
  select r.auth_user_id into v_auth_user_id
  from public.client_permanent_deletion_requests r
  join public.candidate_profiles p on p.id = r.candidate_profile_id
  where r.id = p_request_id and r.candidate_profile_id = p_profile_id
    and r.requested_by_user_id = p_actor_user_id and r.status = 'processing'
    and p.archived_at is not null and p.client_recovery_until < v_now
  for update of r, p;
  if not found then raise exception 'Permanent deletion request unavailable'; end if;
  if exists (select 1 from public.resume_processing_jobs
      where candidate_profile_id = p_profile_id and status = 'processing')
      or exists (select 1 from public.document_regeneration_jobs
        where candidate_profile_id = p_profile_id and status = 'processing')
      or exists (select 1 from public.document_ats_assessments
        where candidate_profile_id = p_profile_id and status = 'processing') then
    raise exception 'Client operations are still active';
  end if;

  delete from public.document_ats_assessments where candidate_profile_id = p_profile_id;
  delete from public.ats_assessment_snapshots where candidate_profile_id = p_profile_id;
  delete from public.document_regeneration_jobs where candidate_profile_id = p_profile_id;
  delete from public.resume_processing_jobs where candidate_profile_id = p_profile_id;
  delete from public.profile_resume_reviews where candidate_profile_id = p_profile_id;
  delete from public.document_records where candidate_profile_id = p_profile_id
    and is_privacy_masked;
  delete from public.document_records where candidate_profile_id = p_profile_id;
  update public.candidate_profiles set existing_resume_file_id = null,
    gcc_photo_file_id = null where id = p_profile_id;
  delete from public.file_records where candidate_profile_id = p_profile_id;
  delete from public.additional_profile_section_items i
    using public.additional_profile_sections s
    where i.additional_profile_section_id = s.id
      and s.candidate_profile_id = p_profile_id;
  delete from public.additional_profile_sections where candidate_profile_id = p_profile_id;
  delete from public.profile_projects where candidate_profile_id = p_profile_id;
  delete from public.profile_languages where candidate_profile_id = p_profile_id;
  delete from public.profile_certifications where candidate_profile_id = p_profile_id;
  delete from public.profile_skills where candidate_profile_id = p_profile_id;
  delete from public.profile_education_entries where candidate_profile_id = p_profile_id;
  delete from public.profile_work_experiences where candidate_profile_id = p_profile_id;
  delete from public.client_onboarding_invitations where candidate_profile_id = p_profile_id;
  delete from public.user_roles where candidate_profile_id = p_profile_id and role_code = 'client';
  delete from public.candidate_profiles where id = p_profile_id;
  if not found then raise exception 'Candidate profile deletion was not completed'; end if;

  update public.client_permanent_deletion_requests set status = 'completed',
    completed_at = v_now, updated_at = v_now, last_error_code = null
  where id = p_request_id and status = 'processing';
  insert into public.client_lifecycle_events
    (candidate_profile_id, auth_user_id, actor_user_id, action, outcome)
  values (p_profile_id, v_auth_user_id, p_actor_user_id,
    'permanent-delete-completed', 'success');
  return true;
end;
$$;

revoke all on function public.enqueue_document_ats_assessment_for_file()
  from public, anon, authenticated;
revoke all on function public.enqueue_document_ats_assessment_for_generated()
  from public, anon, authenticated;
revoke all on function public.claim_document_ats_assessment()
  from public, anon, authenticated;
revoke all on function public.complete_document_ats_assessment(uuid,uuid,text,integer,jsonb,jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_document_ats_assessment(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.archive_client_account(uuid,uuid,integer)
  from public, anon, authenticated;
revoke all on function public.restore_client_account(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.complete_client_permanent_deletion(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_document_ats_assessment() to service_role;
grant execute on function public.complete_document_ats_assessment(uuid,uuid,text,integer,jsonb,jsonb)
  to service_role;
grant execute on function public.fail_document_ats_assessment(uuid,uuid,text)
  to service_role;
grant execute on function public.archive_client_account(uuid,uuid,integer)
  to service_role;
grant execute on function public.restore_client_account(uuid,uuid)
  to service_role;
grant execute on function public.complete_client_permanent_deletion(uuid,uuid,uuid)
  to service_role;

commit;
