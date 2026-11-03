-- Phase 5: narrowly scoped client correction/confirmation for jobs that the
-- deterministic gate marked needs-input.
begin;

alter table public.resume_processing_jobs
  add column input_confirmed_by_user_id uuid references auth.users(id) on delete restrict,
  add column input_confirmed_at timestamptz,
  add constraint resume_processing_jobs_input_confirmation_check check (
    (input_confirmed_by_user_id is null and input_confirmed_at is null)
    or (input_confirmed_by_user_id is not null and input_confirmed_at is not null)
  );

create function public.confirm_client_resume_processing_input(
  p_job_id uuid,
  p_actor_user_id uuid,
  p_approved jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job record;
  v_review_id uuid;
  v_clean_approved jsonb;
begin
  select j.candidate_profile_id, j.source_file_id, j.extractor,
    j.normalized_text_sha256, j.structured_result
  into v_job
  from public.resume_processing_jobs j
  join public.candidate_profiles p on p.id = j.candidate_profile_id
    and p.existing_resume_file_id = j.source_file_id and p.archived_at is null
  where j.id = p_job_id and j.status = 'needs-input'
  for update of j;
  if not found then raise exception 'Current resume input request unavailable'; end if;

  if not exists (
    select 1 from public.user_roles r
    where r.user_id = p_actor_user_id and r.role_code = 'client'
      and r.account_status = 'active'
      and r.candidate_profile_id = v_job.candidate_profile_id
  ) then raise exception 'Active linked client required'; end if;

  if jsonb_typeof(p_approved) <> 'array'
      or jsonb_array_length(p_approved) not between 1 and 200
      or jsonb_typeof(v_job.structured_result->'proposals') <> 'array'
      or (select count(distinct item->>'id') from jsonb_array_elements(p_approved) item)
          <> jsonb_array_length(p_approved)
      or exists (
        select 1 from jsonb_array_elements(p_approved) approved
        where jsonb_typeof(approved) <> 'object'
          or nullif(approved->>'id', '') is null
          or not exists (
            select 1 from jsonb_array_elements(v_job.structured_result->'proposals') stored
            where stored->>'id' = approved->>'id'
              and stored->>'section' = approved->>'section'
              and stored->'sourceLines' = approved->'sourceLines'
          )
      ) then
    raise exception 'Confirmed entries must match the stored proposal set';
  end if;

  select jsonb_agg(item - 'id' order by ordinal)
  into v_clean_approved
  from jsonb_array_elements(p_approved) with ordinality entries(item, ordinal);

  v_review_id := public.confirm_resume_review_v2(
    v_job.candidate_profile_id, v_job.source_file_id, v_job.extractor,
    v_job.normalized_text_sha256, p_actor_user_id, v_clean_approved
  );
  update public.profile_resume_reviews set review_mode = 'client-confirmed'
  where id = v_review_id;
  update public.resume_processing_jobs
  set status = 'completed', input_confirmed_by_user_id = p_actor_user_id,
      input_confirmed_at = now(), completed_at = now(), updated_at = now(),
      last_error_code = null,
      structured_result = structured_result || '{"clientConfirmed":true}'::jsonb
  where id = p_job_id and status = 'needs-input';
  if not found then raise exception 'Resume input completion was not recorded'; end if;
  return v_review_id;
end;
$$;

create function public.confirm_client_canonical_resume_input(
  p_job_id uuid,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job record;
begin
  select j.candidate_profile_id, j.source_file_id into v_job
  from public.resume_processing_jobs j
  join public.candidate_profiles p on p.id = j.candidate_profile_id
    and p.existing_resume_file_id = j.source_file_id and p.archived_at is null
  where j.id = p_job_id and j.status = 'needs-input'
  for update of j;
  if not found then return false; end if;
  if not exists (
    select 1 from public.user_roles r
    where r.user_id = p_actor_user_id and r.role_code = 'client'
      and r.account_status = 'active'
      and r.candidate_profile_id = v_job.candidate_profile_id
  ) then return false; end if;
  if not (
    exists (select 1 from public.profile_work_experiences x where x.candidate_profile_id = v_job.candidate_profile_id and x.archived_at is null)
    or exists (select 1 from public.profile_education_entries x where x.candidate_profile_id = v_job.candidate_profile_id and x.archived_at is null)
    or exists (select 1 from public.profile_projects x where x.candidate_profile_id = v_job.candidate_profile_id and x.archived_at is null)
  ) then return false; end if;

  update public.resume_processing_jobs
  set status = 'completed', input_confirmed_by_user_id = p_actor_user_id,
      input_confirmed_at = now(), completed_at = now(), updated_at = now(),
      last_error_code = null,
      structured_result = structured_result || '{"clientConfirmedCanonicalProfile":true}'::jsonb
  where id = p_job_id and status = 'needs-input';
  if not found then return false; end if;
  perform public.enqueue_entitled_document_outputs(v_job.candidate_profile_id);
  return true;
end;
$$;

-- A client-confirmed canonical profile is also a valid readiness boundary even
-- when no extracted proposal was safe enough to create a review row.
create or replace function public.enqueue_entitled_document_outputs(p_profile_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile record;
  v_count integer := 0;
begin
  select p.selected_package_code, p.career_revision, p.existing_resume_file_id into v_profile
  from public.candidate_profiles p
  where p.id = p_profile_id and p.archived_at is null
  for update;
  if not found then raise exception 'Candidate profile unavailable'; end if;

  if not exists (
    select 1 from public.profile_resume_reviews r
    where r.candidate_profile_id = p_profile_id
  ) and not exists (
    select 1 from public.resume_processing_jobs j
    where j.candidate_profile_id = p_profile_id
      and j.source_file_id = v_profile.existing_resume_file_id
      and j.status = 'completed' and j.input_confirmed_by_user_id is not null
  ) then return 0; end if;

  insert into public.document_regeneration_jobs
    (candidate_profile_id, output_kind, source_career_revision)
  select p_profile_id, output, v_profile.career_revision
  from unnest(enum_range(null::public.generated_output_kind)) as outputs(output)
  where public.is_v1_output_entitled(v_profile.selected_package_code, output)
    and not exists (
      select 1 from public.document_records d
      where d.candidate_profile_id = p_profile_id and d.output_kind = output
        and d.source_career_revision = v_profile.career_revision
        and d.status = 'available' and d.archived_at is null
    )
  on conflict (candidate_profile_id, output_kind, source_career_revision)
  do update set status = 'pending', attempts = 0, lease_token = null,
    lease_until = null, next_attempt_at = now(), last_error_code = null,
    completed_at = null, updated_at = now()
  where public.document_regeneration_jobs.status in ('failed', 'completed');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.confirm_client_resume_processing_input(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_client_resume_processing_input(uuid,uuid,jsonb)
  to service_role;
revoke all on function public.confirm_client_canonical_resume_input(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_client_canonical_resume_input(uuid,uuid)
  to service_role;

commit;
