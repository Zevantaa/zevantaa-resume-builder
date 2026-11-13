-- Issues #7-#9: make the current source's explicit client confirmation the
-- normal generation boundary. Existing accounts, facts, documents and review
-- provenance are preserved; legacy administrator-confirmed sources remain
-- valid, but an unrelated historical review can no longer unlock a replacement.
begin;

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

  -- Only a confirmation tied to the current private source may enqueue work.
  -- Admin-confirmed is retained solely for already reviewed legacy sources.
  if not exists (
    select 1 from public.profile_resume_reviews r
    where r.candidate_profile_id = p_profile_id
      and r.source_file_id = v_profile.existing_resume_file_id
      and r.review_mode in ('client-confirmed', 'admin-confirmed')
  ) and not exists (
    select 1 from public.resume_processing_jobs j
    where j.candidate_profile_id = p_profile_id
      and j.source_file_id = v_profile.existing_resume_file_id
      and j.status = 'completed'
      and j.input_confirmed_by_user_id is not null
      and j.input_confirmed_at is not null
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

comment on function public.enqueue_entitled_document_outputs(uuid) is
  'Idempotently queues package outputs only after current-source client confirmation (or preserved legacy admin confirmation).';

revoke all on function public.enqueue_entitled_document_outputs(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_entitled_document_outputs(uuid)
  to service_role;

-- Confirm extracted facts and client-correctable identity/contact fields in a
-- single transaction. Email remains Auth-linked and cannot be changed here.
create function public.confirm_client_resume_processing_input_v2(
  p_job_id uuid,
  p_actor_user_id uuid,
  p_profile_patch jsonb,
  p_approved jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_review_id uuid;
  v_full_name text := btrim(coalesce(p_profile_patch->>'fullName', ''));
  v_mobile text := btrim(coalesce(p_profile_patch->>'mobileNumber', ''));
  v_whatsapp text := nullif(btrim(coalesce(p_profile_patch->>'whatsappNumber', '')), '');
  v_linkedin text := nullif(btrim(coalesce(p_profile_patch->>'linkedinUrl', '')), '');
  v_location text := btrim(coalesce(p_profile_patch->>'currentLocation', ''));
  v_relocation text := p_profile_patch->>'relocationPreference';
begin
  if jsonb_typeof(p_profile_patch) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(p_profile_patch) as keys(key)
        where key not in ('fullName','mobileNumber','whatsappNumber','linkedinUrl','currentLocation','relocationPreference')
      )
      or char_length(v_full_name) not between 2 and 160
      or char_length(v_mobile) not between 5 and 40
      or char_length(v_location) not between 2 and 200
      or char_length(coalesce(v_whatsapp, '')) > 40
      or char_length(coalesce(v_linkedin, '')) > 500
      or (v_linkedin is not null and v_linkedin !~* '^https://([a-z0-9-]+\.)?linkedin\.com/')
      or v_relocation not in ('open','not-open','conditional','not-specified')
  then raise exception 'Invalid client profile correction'; end if;

  select j.candidate_profile_id into v_profile_id
  from public.resume_processing_jobs j
  join public.candidate_profiles p on p.id = j.candidate_profile_id
    and p.existing_resume_file_id = j.source_file_id and p.archived_at is null
  join public.user_roles r on r.user_id = p_actor_user_id
    and r.role_code = 'client' and r.account_status = 'active'
    and r.candidate_profile_id = j.candidate_profile_id
  where j.id = p_job_id and j.status = 'needs-input'
  for update of j, p;
  if not found then raise exception 'Current linked client review unavailable'; end if;

  v_review_id := public.confirm_client_resume_processing_input(
    p_job_id, p_actor_user_id, p_approved
  );
  update public.candidate_profiles set
    full_name = v_full_name,
    mobile_number = v_mobile,
    whatsapp_number = v_whatsapp,
    linkedin_url = v_linkedin,
    current_location = v_location,
    relocation_preference = v_relocation::public.relocation_preference,
    updated_by_user_id = p_actor_user_id,
    updated_at = now()
  where id = v_profile_id and archived_at is null;
  if not found then raise exception 'Client profile correction was not recorded'; end if;
  return v_review_id;
end;
$$;

revoke all on function public.confirm_client_resume_processing_input_v2(uuid,uuid,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_client_resume_processing_input_v2(uuid,uuid,jsonb,jsonb)
  to service_role;

commit;
