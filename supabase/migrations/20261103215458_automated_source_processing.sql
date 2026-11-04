-- Phase 1: durable, private source-resume processing.
-- Source uploads remain in candidate-intake-private. This migration records
-- content identity and creates service-role-only processing jobs; it does not
-- expose candidate data or queue functions to browser roles.
begin;

alter table public.file_records
  add column content_sha256 text,
  add constraint file_records_content_sha256_check check (
    content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'
  );

comment on column public.file_records.content_sha256 is
  'Server-calculated SHA-256 of validated upload bytes. Null for legacy rows and non-hashed files.';

create type public.resume_processing_status as enum (
  'pending',
  'processing',
  'needs-input',
  'completed',
  'failed'
);

create table public.resume_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  source_file_id uuid not null,
  source_content_sha256 text not null
    check (source_content_sha256 ~ '^[0-9a-f]{64}$'),
  status public.resume_processing_status not null default 'pending',
  attempts integer not null default 0 check (attempts between 0 and 3),
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  extractor text check (
    extractor is null or extractor in ('word-extractor', 'mammoth', 'pdfjs-dist')
  ),
  normalized_text_sha256 text check (
    normalized_text_sha256 is null or normalized_text_sha256 ~ '^[0-9a-f]{64}$'
  ),
  structured_result jsonb check (
    structured_result is null or (
      jsonb_typeof(structured_result) = 'object'
      and pg_column_size(structured_result) <= 1048576
    )
  ),
  readiness_findings jsonb not null default '[]'::jsonb check (
    jsonb_typeof(readiness_findings) = 'array'
    and pg_column_size(readiness_findings) <= 131072
  ),
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[a-z0-9-]{1,80}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint resume_processing_jobs_source_fk
    foreign key (candidate_profile_id, source_file_id)
    references public.file_records (candidate_profile_id, id) on delete restrict,
  constraint resume_processing_jobs_one_per_source
    unique (candidate_profile_id, source_file_id),
  constraint resume_processing_jobs_lease_check check (
    (status = 'processing' and lease_token is not null and lease_until is not null)
    or (status <> 'processing' and lease_token is null and lease_until is null)
  ),
  constraint resume_processing_jobs_completion_check check (
    (status in ('completed', 'needs-input') and completed_at is not null)
    or (status not in ('completed', 'needs-input') and completed_at is null)
  )
);

create index resume_processing_jobs_claim_idx
  on public.resume_processing_jobs (next_attempt_at, created_at, id)
  where status in ('pending', 'processing', 'failed') and attempts < 3;
create index resume_processing_jobs_profile_status_idx
  on public.resume_processing_jobs (candidate_profile_id, status, created_at desc);

alter table public.resume_processing_jobs enable row level security;
revoke all on public.resume_processing_jobs from public, anon, authenticated;
grant select, insert, update on public.resume_processing_jobs to service_role;

create function public.enqueue_source_resume_processing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source record;
begin
  if new.existing_resume_file_id is not distinct from old.existing_resume_file_id
      or new.existing_resume_file_id is null then
    return new;
  end if;

  select f.id, f.content_sha256
    into v_source
  from public.file_records f
  where f.id = new.existing_resume_file_id
    and f.candidate_profile_id = new.id
    and f.purpose = 'source-resume'
    and f.status = 'available'
    and f.access_level = 'private'
    and f.storage_bucket_name = 'candidate-intake-private'
    and f.archived_at is null;

  if not found or v_source.content_sha256 is null then
    raise exception 'Current source resume is unavailable or lacks content identity';
  end if;

  -- A replacement makes unfinished work for an older source permanently stale.
  update public.resume_processing_jobs
  set status = 'failed', attempts = 3, lease_token = null, lease_until = null,
      next_attempt_at = now(), last_error_code = 'source-replaced',
      updated_at = now(), completed_at = null
  where candidate_profile_id = new.id
    and source_file_id <> new.existing_resume_file_id
    and status in ('pending', 'processing', 'failed');

  insert into public.resume_processing_jobs (
    candidate_profile_id, source_file_id, source_content_sha256
  ) values (
    new.id, new.existing_resume_file_id, v_source.content_sha256
  )
  on conflict (candidate_profile_id, source_file_id) do nothing;

  return new;
end;
$$;

create trigger candidate_profiles_enqueue_source_processing
after update of existing_resume_file_id on public.candidate_profiles
for each row
when (new.existing_resume_file_id is distinct from old.existing_resume_file_id)
execute function public.enqueue_source_resume_processing();

revoke all on function public.enqueue_source_resume_processing()
  from public, anon, authenticated;

create function public.claim_resume_processing_job(p_profile_id uuid default null)
returns table (
  job_id uuid,
  candidate_profile_id uuid,
  source_file_id uuid,
  source_content_sha256 text,
  lease_token uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.resume_processing_jobs j
  set status = 'processing',
      lease_token = gen_random_uuid(),
      lease_until = now() + interval '6 minutes',
      attempts = j.attempts + 1,
      updated_at = now(),
      last_error_code = null
  where j.id = (
    select q.id
    from public.resume_processing_jobs q
    where (p_profile_id is null or q.candidate_profile_id = p_profile_id)
      and q.attempts < 3
      and q.next_attempt_at <= now()
      and (
        q.status in ('pending', 'failed')
        or (q.status = 'processing' and q.lease_until < now())
      )
    order by q.created_at, q.id
    limit 1
    for update skip locked
  )
  returning j.id, j.candidate_profile_id, j.source_file_id,
    j.source_content_sha256, j.lease_token
  into job_id, candidate_profile_id, source_file_id,
    source_content_sha256, lease_token;

  if job_id is not null then
    return next;
  end if;
end;
$$;

create function public.complete_resume_processing_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_status public.resume_processing_status,
  p_extractor text,
  p_normalized_text_sha256 text,
  p_structured_result jsonb,
  p_readiness_findings jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('completed', 'needs-input')
      or (p_extractor is not null and p_extractor not in ('word-extractor', 'mammoth', 'pdfjs-dist'))
      or (p_normalized_text_sha256 is not null
        and p_normalized_text_sha256 !~ '^[0-9a-f]{64}$')
      or (p_structured_result is not null and (
        jsonb_typeof(p_structured_result) <> 'object'
        or pg_column_size(p_structured_result) > 1048576))
      or p_readiness_findings is null
      or jsonb_typeof(p_readiness_findings) <> 'array'
      or pg_column_size(p_readiness_findings) > 131072
      or (p_status = 'completed' and (
        p_extractor is null or p_normalized_text_sha256 is null
        or p_structured_result is null)) then
    raise exception 'Invalid resume-processing completion';
  end if;

  update public.resume_processing_jobs
  set status = p_status,
      lease_token = null,
      lease_until = null,
      extractor = p_extractor,
      normalized_text_sha256 = p_normalized_text_sha256,
      structured_result = p_structured_result,
      readiness_findings = p_readiness_findings,
      last_error_code = null,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id
    and status = 'processing'
    and lease_token = p_lease_token
    and lease_until > now();

  return found;
end;
$$;

create function public.fail_resume_processing_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'Invalid resume-processing error code';
  end if;

  update public.resume_processing_jobs
  set status = 'failed',
      lease_token = null,
      lease_until = null,
      next_attempt_at = now() + interval '2 minutes',
      last_error_code = p_error_code,
      updated_at = now()
  where id = p_job_id
    and status = 'processing'
    and lease_token = p_lease_token;

  return found;
end;
$$;

revoke all on function public.claim_resume_processing_job(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_resume_processing_job(uuid)
  to service_role;
revoke all on function public.complete_resume_processing_job(
  uuid, uuid, public.resume_processing_status, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_resume_processing_job(
  uuid, uuid, public.resume_processing_status, text, text, jsonb, jsonb
) to service_role;
revoke all on function public.fail_resume_processing_job(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_resume_processing_job(uuid, uuid, text)
  to service_role;

commit;
