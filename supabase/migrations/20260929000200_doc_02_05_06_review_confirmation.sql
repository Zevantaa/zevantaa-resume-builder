-- DOC-02 review provenance and atomic, admin-confirmed append to canonical data.
-- No extracted text or plaintext credentials are persisted.
begin;

create table public.profile_resume_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  source_file_id uuid not null,
  extractor text not null check (extractor in ('word-extractor', 'mammoth', 'pdfjs-dist')),
  normalized_text_sha256 text not null check (normalized_text_sha256 ~ '^[0-9a-f]{64}$'),
  approved_entries jsonb not null check (jsonb_typeof(approved_entries) = 'array'),
  approved_entry_count integer not null check (approved_entry_count > 0 and approved_entry_count <= 200),
  confirmed_by_user_id uuid not null,
  confirmed_at timestamptz not null default now(),
  constraint profile_resume_reviews_profile_fk foreign key (candidate_profile_id)
    references public.candidate_profiles(id) on delete restrict,
  constraint profile_resume_reviews_file_fk foreign key (candidate_profile_id, source_file_id)
    references public.file_records(candidate_profile_id, id) on delete restrict,
  constraint profile_resume_reviews_admin_fk foreign key (confirmed_by_user_id)
    references auth.users(id) on delete restrict,
  constraint profile_resume_reviews_one_per_source unique (candidate_profile_id, source_file_id)
);
create index profile_resume_reviews_source_idx on public.profile_resume_reviews(candidate_profile_id, confirmed_at desc);
alter table public.profile_resume_reviews enable row level security;
revoke all on public.profile_resume_reviews from public, anon, authenticated;
grant select, insert on public.profile_resume_reviews to service_role;

create function public.confirm_resume_review(
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
    where user_id = p_admin_user_id and role_code = 'admin' and account_status = 'active'
  ) then raise exception 'Administrator authorization required'; end if;
  if p_approved is null or jsonb_typeof(p_approved) <> 'array'
    or jsonb_array_length(p_approved) not between 1 and 200
    or p_extractor not in ('word-extractor', 'mammoth', 'pdfjs-dist')
    or p_text_sha256 !~ '^[0-9a-f]{64}$'
  then raise exception 'Invalid review payload'; end if;

  -- Serializes confirmations for this profile and rejects stale/replaced files.
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
revoke all on function public.confirm_resume_review(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_resume_review(uuid, uuid, text, text, uuid, jsonb) to service_role;

commit;
