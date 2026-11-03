-- Phase 2: automatically accept only the deterministic proposals produced by
-- a leased source-processing job. Browser roles still cannot call review RPCs.
begin;

alter table public.profile_resume_reviews
  add column review_mode text not null default 'admin-confirmed'
    check (review_mode in ('automatic', 'client-confirmed', 'admin-confirmed'));

comment on column public.profile_resume_reviews.review_mode is
  'How reviewed source facts entered the canonical profile; never an assertion of fact quality.';

-- Preserve the existing atomic write implementation while allowing the active
-- linked client to be the provenance actor. EXECUTE remains service-role-only.
create or replace function public.confirm_resume_review(
  p_profile_id uuid, p_source_file_id uuid, p_extractor text,
  p_text_sha256 text, p_admin_user_id uuid, p_approved jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_review_id uuid;
  v_item jsonb;
  v_fields jsonb;
  v_section text;
  v_note text;
  v_order integer;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = p_admin_user_id and account_status = 'active'
      and (role_code = 'admin'
        or (role_code = 'client' and candidate_profile_id = p_profile_id))
  ) then raise exception 'Authorized review actor required'; end if;
  if p_approved is null or jsonb_typeof(p_approved) <> 'array'
    or jsonb_array_length(p_approved) not between 1 and 200
    or p_extractor not in ('word-extractor', 'mammoth', 'pdfjs-dist')
    or p_text_sha256 !~ '^[0-9a-f]{64}$'
  then raise exception 'Invalid review payload'; end if;

  perform 1 from public.candidate_profiles p
    where p.id = p_profile_id and p.existing_resume_file_id = p_source_file_id
      and p.archived_at is null for update;
  if not found then raise exception 'Source resume changed or profile unavailable'; end if;
  if not exists (
    select 1 from public.file_records f where f.id = p_source_file_id
      and f.candidate_profile_id = p_profile_id and f.purpose = 'source-resume'
      and f.status = 'available' and f.access_level = 'private' and f.archived_at is null
  ) then raise exception 'Private source resume unavailable'; end if;

  insert into public.profile_resume_reviews
    (candidate_profile_id, source_file_id, extractor, normalized_text_sha256,
     approved_entries, approved_entry_count, confirmed_by_user_id)
  values (p_profile_id, p_source_file_id, p_extractor, p_text_sha256,
    p_approved, jsonb_array_length(p_approved), p_admin_user_id)
  returning id into v_review_id;
  v_note := 'Approved resume review ' || v_review_id::text || '; source file ' || p_source_file_id::text;

  for v_item in select value from jsonb_array_elements(p_approved) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item->'fields') is distinct from 'object'
      or jsonb_typeof(v_item->'sourceLines') is distinct from 'array'
    then raise exception 'Invalid reviewed entry'; end if;
    v_fields := v_item->'fields';
    v_section := v_item->>'section';
    if v_section = 'summary' then
      if nullif(btrim(v_fields->>'text'), '') is null then raise exception 'Empty summary'; end if;
      update public.candidate_profiles set professional_summary = btrim(v_fields->>'text'),
        updated_at = now(), updated_by_user_id = p_admin_user_id,
        administrative_note = concat_ws(E'\n', administrative_note, v_note) where id = p_profile_id;
    elsif v_section = 'employment' then
      if nullif(btrim(v_fields->>'jobTitle'), '') is null or nullif(btrim(v_fields->>'employerName'), '') is null
        or (v_fields->>'startDate') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      then raise exception 'Invalid employment'; end if;
      select coalesce(max(sort_order)+1, 0) into v_order from public.profile_work_experiences where candidate_profile_id=p_profile_id;
      insert into public.profile_work_experiences(candidate_profile_id, sort_order, employer_name, job_title,
        start_date, end_date, is_current_role, created_by_user_id, updated_by_user_id, administrative_note)
      values(p_profile_id, v_order, btrim(v_fields->>'employerName'), btrim(v_fields->>'jobTitle'),
        v_fields->>'startDate', nullif(v_fields->>'endDate',''), (v_fields->>'isCurrentRole')::boolean,
        p_admin_user_id, p_admin_user_id, v_note);
    elsif v_section = 'education' then
      if nullif(btrim(v_fields->>'qualification'), '') is null or nullif(btrim(v_fields->>'institutionName'), '') is null
      then raise exception 'Invalid education'; end if;
      select coalesce(max(sort_order)+1, 0) into v_order from public.profile_education_entries where candidate_profile_id=p_profile_id;
      insert into public.profile_education_entries(candidate_profile_id, sort_order, qualification, institution_name,
        start_date, end_date, created_by_user_id, updated_by_user_id, administrative_note)
      values(p_profile_id, v_order, btrim(v_fields->>'qualification'), btrim(v_fields->>'institutionName'),
        nullif(v_fields->>'startDate',''), nullif(v_fields->>'endDate',''), p_admin_user_id, p_admin_user_id, v_note);
    elsif v_section = 'skills' then
      if nullif(btrim(v_fields->>'name'), '') is null then raise exception 'Invalid skill'; end if;
      select coalesce(max(sort_order)+1, 0) into v_order from public.profile_skills where candidate_profile_id=p_profile_id;
      insert into public.profile_skills(candidate_profile_id, sort_order, name, created_by_user_id, updated_by_user_id, administrative_note)
      values(p_profile_id, v_order, btrim(v_fields->>'name'), p_admin_user_id, p_admin_user_id, v_note);
    elsif v_section = 'certifications' then
      if nullif(btrim(v_fields->>'name'), '') is null or nullif(btrim(v_fields->>'issuingOrganization'), '') is null
      then raise exception 'Invalid certification'; end if;
      select coalesce(max(sort_order)+1, 0) into v_order from public.profile_certifications where candidate_profile_id=p_profile_id;
      insert into public.profile_certifications(candidate_profile_id, sort_order, name, issuing_organization,
        issued_on, expires_on, created_by_user_id, updated_by_user_id, administrative_note)
      values(p_profile_id, v_order, btrim(v_fields->>'name'), btrim(v_fields->>'issuingOrganization'),
        nullif(v_fields->>'issuedOn',''), nullif(v_fields->>'expiresOn',''), p_admin_user_id, p_admin_user_id, v_note);
    elsif v_section = 'languages' then
      if nullif(btrim(v_fields->>'name'), '') is null then raise exception 'Invalid language'; end if;
      select coalesce(max(sort_order)+1, 0) into v_order from public.profile_languages where candidate_profile_id=p_profile_id;
      insert into public.profile_languages(candidate_profile_id, sort_order, name, created_by_user_id, updated_by_user_id, administrative_note)
      values(p_profile_id, v_order, btrim(v_fields->>'name'), p_admin_user_id, p_admin_user_id, v_note);
    elsif v_section = 'projects' then
      if nullif(btrim(v_fields->>'name'), '') is null then raise exception 'Invalid project'; end if;
      select coalesce(max(sort_order)+1, 0) into v_order from public.profile_projects where candidate_profile_id=p_profile_id;
      insert into public.profile_projects(candidate_profile_id, sort_order, name, created_by_user_id, updated_by_user_id, administrative_note)
      values(p_profile_id, v_order, btrim(v_fields->>'name'), p_admin_user_id, p_admin_user_id, v_note);
    elsif v_section = 'additional' then
      if nullif(btrim(v_fields->>'heading'), '') is null then raise exception 'Invalid additional section'; end if;
      select coalesce(max(sort_order)+1, 0) into v_order from public.additional_profile_sections where candidate_profile_id=p_profile_id;
      insert into public.additional_profile_sections(candidate_profile_id, sort_order, title,
        created_by_user_id, updated_by_user_id, administrative_note)
      values(p_profile_id, v_order, btrim(v_fields->>'heading'), p_admin_user_id, p_admin_user_id, v_note);
    else raise exception 'Unknown review section'; end if;
  end loop;
  return v_review_id;
end $$;

create function public.resume_profile_is_empty_for_automatic_import(p_profile_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.candidate_profiles p
    where p.id = p_profile_id
      and p.archived_at is null
      and nullif(btrim(p.professional_summary), '') is null
      and not exists (select 1 from public.profile_resume_reviews r where r.candidate_profile_id = p.id)
      and not exists (select 1 from public.profile_work_experiences x where x.candidate_profile_id = p.id)
      and not exists (select 1 from public.profile_education_entries x where x.candidate_profile_id = p.id)
      and not exists (select 1 from public.profile_skills x where x.candidate_profile_id = p.id)
      and not exists (select 1 from public.profile_certifications x where x.candidate_profile_id = p.id)
      and not exists (select 1 from public.profile_languages x where x.candidate_profile_id = p.id)
      and not exists (select 1 from public.profile_projects x where x.candidate_profile_id = p.id)
      and not exists (select 1 from public.additional_profile_sections x where x.candidate_profile_id = p.id)
  );
$$;

revoke all on function public.resume_profile_is_empty_for_automatic_import(uuid)
  from public, anon, authenticated;
grant execute on function public.resume_profile_is_empty_for_automatic_import(uuid)
  to service_role;

create function public.accept_automated_resume_processing_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_extractor text,
  p_normalized_text_sha256 text,
  p_structured_result jsonb,
  p_readiness_findings jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job record;
  v_review_id uuid;
  v_actor_user_id uuid;
begin
  select j.candidate_profile_id, j.source_file_id
    into v_job
  from public.resume_processing_jobs j
  where j.id = p_job_id and j.status = 'processing'
    and j.lease_token = p_lease_token and j.lease_until > now()
  for update;
  if not found then raise exception 'Resume-processing lease is stale'; end if;

  if jsonb_typeof(p_structured_result) <> 'object'
      or p_structured_result->>'autoAcceptable' <> 'true'
      or jsonb_typeof(p_structured_result->'proposals') <> 'array'
      or jsonb_typeof(p_readiness_findings) <> 'array'
      or jsonb_array_length(p_readiness_findings) <> 0 then
    raise exception 'Automatic resume acceptance requires the exact unambiguous proposal set';
  end if;

  -- Re-check under the same transaction that will publish canonical facts.
  -- This blocks duplicate append/merge even if the profile changed after the
  -- worker's earlier readiness check.
  if not public.resume_profile_is_empty_for_automatic_import(v_job.candidate_profile_id)
  then raise exception 'Existing profile facts require an explicit merge review'; end if;

  select r.user_id into v_actor_user_id
  from public.user_roles r
  where r.role_code = 'client' and r.account_status = 'active'
    and r.candidate_profile_id = v_job.candidate_profile_id
  order by r.created_at, r.user_id
  limit 1;
  if v_actor_user_id is null then
    raise exception 'Active linked client provenance actor required';
  end if;

  v_review_id := public.confirm_resume_review_v2(
    v_job.candidate_profile_id,
    v_job.source_file_id,
    p_extractor,
    p_normalized_text_sha256,
    v_actor_user_id,
    p_structured_result->'proposals'
  );

  update public.profile_resume_reviews
  set review_mode = 'automatic'
  where id = v_review_id;

  update public.resume_processing_jobs
  set status = 'completed', lease_token = null, lease_until = null,
      extractor = p_extractor,
      normalized_text_sha256 = p_normalized_text_sha256,
      structured_result = p_structured_result,
      readiness_findings = p_readiness_findings,
      last_error_code = null, completed_at = now(), updated_at = now()
  where id = p_job_id and lease_token = p_lease_token and status = 'processing';
  if not found then raise exception 'Resume-processing completion was not recorded'; end if;

  return v_review_id;
end;
$$;

revoke all on function public.accept_automated_resume_processing_job(
  uuid, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.accept_automated_resume_processing_job(
  uuid, uuid, text, text, jsonb, jsonb
) to service_role;

commit;
