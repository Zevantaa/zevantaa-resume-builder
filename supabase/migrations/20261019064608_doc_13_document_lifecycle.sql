begin;

-- Generated PDFs never share the intake bucket or its access policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-documents-private', 'candidate-documents-private', false,
  10485760, array['application/pdf']::text[])
on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'candidate-documents-private'
      and public = false and file_size_limit = 10485760
      and allowed_mime_types = array['application/pdf']::text[]) then
    raise exception 'Generated-document bucket configuration is not private and exact';
  end if;
end $$;
-- No storage.objects policy is granted to anon/authenticated. Trusted server
-- code uses the service key, and every download passes an application guard.

alter table public.file_records drop constraint file_records_purpose_format_check;
alter table public.file_records add constraint file_records_purpose_format_check check (
  (purpose = 'source-resume' and (
    (mime_type = 'application/pdf' and file_extension = 'pdf') or
    (mime_type = 'application/msword' and file_extension = 'doc') or
    (mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' and file_extension = 'docx')))
  or (purpose = 'gcc-profile-photo' and (
    (mime_type = 'image/jpeg' and file_extension in ('jpg','jpeg')) or
    (mime_type = 'image/png' and file_extension = 'png') or
    (mime_type = 'image/webp' and file_extension = 'webp')))
  or (purpose = 'generated-document' and mime_type = 'application/pdf'
      and file_extension = 'pdf' and access_level = 'private'
      and (storage_bucket_name is null or storage_bucket_name = 'candidate-documents-private'))
);

create type public.generated_output_kind as enum (
  'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
  'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5',
  'gcc-resume', 'europass-eu-resume', 'general-corporate-cover-letter',
  'international-relocation-cover-letter', 'technology-startup-cover-letter',
  'global-ats-employer-masked'
);
create type public.regeneration_job_status as enum ('pending','processing','completed','failed');

alter table public.document_records
  add column output_kind public.generated_output_kind,
  add column source_career_revision bigint check (source_career_revision >= 0);
-- Legacy seeded/generated records have no trustworthy variant ID. They remain
-- history, never guessed from a filename or exposed as current deliverables.
create unique index document_records_one_current_output_idx
  on public.document_records (candidate_profile_id, output_kind)
  where status = 'available' and output_kind is not null and archived_at is null;
create unique index document_records_output_version_idx
  on public.document_records (candidate_profile_id, output_kind, version_number)
  where output_kind is not null;
create index document_records_history_idx
  on public.document_records (candidate_profile_id, output_kind, version_number desc)
  where output_kind is not null;

create table public.document_regeneration_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete restrict,
  output_kind public.generated_output_kind not null,
  source_career_revision bigint not null check (source_career_revision >= 0),
  status public.regeneration_job_status not null default 'pending',
  attempts integer not null default 0 check (attempts between 0 and 3),
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (candidate_profile_id, output_kind, source_career_revision),
  constraint document_regeneration_jobs_no_mask_check
    check (output_kind <> 'global-ats-employer-masked'),
  constraint document_regeneration_jobs_lease_check check (
    (status = 'processing' and lease_token is not null and lease_until is not null)
    or (status <> 'processing' and lease_token is null and lease_until is null))
);
create index document_regeneration_jobs_claim_idx
  on public.document_regeneration_jobs (candidate_profile_id, next_attempt_at, created_at)
  where status in ('pending','failed','processing') and attempts < 3;
alter table public.document_regeneration_jobs enable row level security;
revoke all on public.document_regeneration_jobs from public, anon, authenticated;
grant select, insert, update on public.document_regeneration_jobs to service_role;

create function public.invalidate_generated_documents_on_career_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_output public.generated_output_kind;
begin
  if new.career_revision = old.career_revision then return new; end if;
  -- The existing career-save RPC can write several child rows, and each child
  -- can advance the revision. Carry uncompleted work forward to the FINAL
  -- revision instead of stranding the first queued job at an intermediate one.
  update public.document_regeneration_jobs set
    source_career_revision = new.career_revision, status = 'pending', attempts = 0,
    lease_token = null, lease_until = null, next_attempt_at = now(),
    updated_at = now(), last_error_code = null
  where candidate_profile_id = new.id and source_career_revision < new.career_revision
    and status in ('pending', 'processing', 'failed');
  for v_output in
    select distinct d.output_kind from public.document_records d
    where d.candidate_profile_id = new.id and d.status in ('available', 'outdated')
      and d.output_kind is not null and not d.is_privacy_masked
      and d.archived_at is null
      and d.version_number = (select max(latest.version_number)
        from public.document_records latest where latest.candidate_profile_id = new.id
          and latest.output_kind = d.output_kind and latest.archived_at is null)
      and exists (
        select 1 from public.package_definitions p
        where p.code = new.selected_package_code and p.is_active and p.archived_at is null
          and (
            (d.output_kind in ('general-corporate-cover-letter',
              'international-relocation-cover-letter', 'technology-startup-cover-letter')
              and p.code = 'executive-transition-agency-distribution')
            or (case
              when d.output_kind = 'global-ats-resume' then 'global-ats'::public.resume_format_family
              when d.output_kind::text like 'domestic-resume-%' then 'domestic'::public.resume_format_family
              when d.output_kind = 'gcc-resume' then 'gcc-middle-east'::public.resume_format_family
              when d.output_kind = 'europass-eu-resume' then 'europass-european-union'::public.resume_format_family
              else null end = any(p.resume_format_families))
          )
      )
  loop
    insert into public.document_regeneration_jobs
      (candidate_profile_id, output_kind, source_career_revision)
    values (new.id, v_output, new.career_revision)
    on conflict (candidate_profile_id, output_kind, source_career_revision) do nothing;
  end loop;
  update public.document_records set status = 'outdated', updated_at = now()
    where candidate_profile_id = new.id and status = 'available'
      and origin = 'generated' and output_kind is not null and archived_at is null;
  return new;
end $$;
create trigger candidate_profiles_invalidate_generated_documents
after update of career_revision on public.candidate_profiles
for each row when (new.career_revision is distinct from old.career_revision)
execute function public.invalidate_generated_documents_on_career_change();
revoke all on function public.invalidate_generated_documents_on_career_change()
  from public, anon, authenticated;

create function public.claim_document_regeneration_job(p_profile_id uuid)
returns table (job_id uuid, output_kind public.generated_output_kind,
  source_career_revision bigint, lease_token uuid)
language plpgsql security invoker set search_path = '' as $$
begin
  update public.document_regeneration_jobs j set status = 'processing',
      lease_token = gen_random_uuid(), lease_until = now() + interval '3 minutes',
      attempts = j.attempts + 1, updated_at = now()
  where j.id = (
    select q.id from public.document_regeneration_jobs q
    where q.candidate_profile_id = p_profile_id and q.attempts < 3
      and q.next_attempt_at <= now()
      and (q.status in ('pending','failed')
        or (q.status = 'processing' and q.lease_until < now()))
    order by q.created_at, q.id limit 1 for update skip locked
  )
  returning j.id, j.output_kind, j.source_career_revision, j.lease_token
  into job_id, output_kind, source_career_revision, lease_token;
  if job_id is not null then return next; end if;
end $$;

create function public.fail_document_regeneration_job(
  p_job_id uuid, p_lease_token uuid, p_error_code text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.document_regeneration_jobs set status = 'failed',
    lease_token = null, lease_until = null, updated_at = now(),
    next_attempt_at = now() + interval '2 minutes',
    last_error_code = left(coalesce(p_error_code, 'generation-failed'), 80)
  where id = p_job_id and status = 'processing' and lease_token = p_lease_token;
  return found;
end $$;

create function public.publish_generated_document(
  p_profile_id uuid, p_output_kind public.generated_output_kind,
  p_document_id uuid, p_file_id uuid, p_object_key text,
  p_file_name text, p_byte_size bigint, p_career_revision bigint,
  p_package_code public.v1_package_code, p_mask_source_id uuid default null,
  p_job_id uuid default null, p_lease_token uuid default null)
returns table (published_document_id uuid, published_version integer)
language plpgsql security invoker set search_path = '' as $$
declare v_profile record; v_previous_file_id uuid; v_previous_version integer; v_version integer;
  v_family public.resume_format_family; v_letter public.cover_letter_type;
  v_mask boolean := p_output_kind = 'global-ats-employer-masked';
begin
  select selected_package_code, career_revision into v_profile
  from public.candidate_profiles where id = p_profile_id and archived_at is null for update;
  if not found or v_profile.selected_package_code <> p_package_code
      or v_profile.career_revision <> p_career_revision then
    raise exception 'Profile/package/revision changed before publication';
  end if;
  if p_byte_size <= 0 or p_byte_size > 10485760
      or p_object_key <> (p_profile_id::text || '/' || p_document_id::text || '/' || p_file_id::text || '.pdf')
      or p_file_name !~ '^[^/\\[:cntrl:]]{1,160}\.pdf$' then
    raise exception 'Invalid generated-file metadata';
  end if;
  if (p_job_id is not null and not exists (
    select 1 from public.document_regeneration_jobs j where j.id = p_job_id
      and j.candidate_profile_id = p_profile_id and j.output_kind = p_output_kind
      and j.source_career_revision = p_career_revision and j.status = 'processing'
      and j.lease_token = p_lease_token and j.lease_until > now())) then
    raise exception 'Regeneration lease is stale';
  end if;
  if v_mask then
    if p_mask_source_id is null or not exists (
      select 1 from public.document_records d where d.id = p_mask_source_id
        and d.candidate_profile_id = p_profile_id and d.output_kind = 'global-ats-resume'
        and d.status = 'available' and d.source_career_revision = p_career_revision) then
      raise exception 'Current unmasked source document is required';
    end if;
  elsif p_mask_source_id is not null then
    raise exception 'Only masked output may reference a source';
  end if;
  select file_record_id, version_number into v_previous_file_id, v_previous_version
    from public.document_records where candidate_profile_id = p_profile_id
      and output_kind = p_output_kind order by version_number desc limit 1;
  v_version := coalesce(v_previous_version, 0) + 1;
  if p_output_kind in ('general-corporate-cover-letter',
      'international-relocation-cover-letter','technology-startup-cover-letter') then
    v_letter := replace(p_output_kind::text, '-cover-letter', '')::public.cover_letter_type;
  else
    v_family := case when p_output_kind in ('global-ats-resume','global-ats-employer-masked') then 'global-ats'
      when p_output_kind::text like 'domestic-resume-%' then 'domestic'
      when p_output_kind = 'gcc-resume' then 'gcc-middle-east'
      else 'europass-european-union' end;
  end if;
  update public.document_records set status = 'superseded', updated_at = now()
    where candidate_profile_id = p_profile_id and output_kind = p_output_kind
      and status = 'available' and archived_at is null;
  insert into public.file_records (id, candidate_profile_id, purpose, original_file_name,
    stored_file_name, mime_type, file_extension, size_bytes, storage_bucket_name,
    storage_object_key, access_level, status, version_number, replaces_file_id, uploaded_at)
  values (p_file_id, p_profile_id, 'generated-document', p_file_name,
    p_file_id::text || '.pdf', 'application/pdf', 'pdf', p_byte_size,
    'candidate-documents-private', p_object_key, 'private', 'available',
    v_version, v_previous_file_id, now());
  insert into public.document_records (id, candidate_profile_id, category, origin,
    status, version_number, package_code, resume_format_family, cover_letter_type,
    is_privacy_masked, privacy_mask_source_document_id, file_record_id,
    file_name_stem, file_extension, generated_at, output_kind, source_career_revision)
  values (p_document_id, p_profile_id,
    case when v_letter is null then 'resume' else 'cover-letter' end::public.document_category,
    'generated', 'available', v_version, p_package_code, v_family, v_letter,
    v_mask, p_mask_source_id, p_file_id,
    left(p_file_name, length(p_file_name) - 4), 'pdf', now(), p_output_kind, p_career_revision);
  if p_job_id is not null then
    update public.document_regeneration_jobs set status = 'completed',
      lease_token = null, lease_until = null, completed_at = now(), updated_at = now()
      where id = p_job_id and lease_token = p_lease_token and status = 'processing';
  end if;
  published_document_id := p_document_id; published_version := v_version;
  return next;
end $$;

revoke all on function public.claim_document_regeneration_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_document_regeneration_job(uuid) to service_role;
revoke all on function public.fail_document_regeneration_job(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.fail_document_regeneration_job(uuid,uuid,text) to service_role;
revoke all on function public.publish_generated_document(
  uuid,public.generated_output_kind,uuid,uuid,text,text,bigint,bigint,
  public.v1_package_code,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.publish_generated_document(
  uuid,public.generated_output_kind,uuid,uuid,text,text,bigint,bigint,
  public.v1_package_code,uuid,uuid,uuid) to service_role;

commit;
