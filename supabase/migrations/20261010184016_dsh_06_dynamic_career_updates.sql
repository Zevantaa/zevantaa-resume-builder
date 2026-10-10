-- DSH-06: one atomic, revision-checked write path for client-authored career facts.
-- Apply only after review; this migration does not grant browser table writes.
begin;

alter table public.candidate_profiles
  add column career_revision bigint not null default 0 check (career_revision >= 0),
  add column professional_summary_source text check
    (professional_summary_source in ('client-authored', 'admin-confirmed')),
  add column professional_summary_updated_by_user_id uuid,
  add column professional_summary_updated_at timestamptz;

create function public.track_career_summary_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.professional_summary is distinct from old.professional_summary then
    new.career_revision := greatest(new.career_revision, old.career_revision + 1);
    new.professional_summary_source := case when exists (
      select 1 from public.user_roles r where r.user_id = new.updated_by_user_id
        and r.role_code = 'client' and r.candidate_profile_id = new.id
    ) then 'client-authored' else 'admin-confirmed' end;
    new.professional_summary_updated_by_user_id := new.updated_by_user_id;
    new.professional_summary_updated_at := now();
  end if;
  return new;
end $$;

create trigger candidate_profiles_track_career_summary
before update of professional_summary on public.candidate_profiles
for each row execute function public.track_career_summary_change();

create function public.bump_profile_career_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_profile_id uuid; v_section_id uuid;
begin
  if tg_table_name = 'additional_profile_section_items' then
    v_section_id := case when tg_op = 'DELETE' then old.additional_profile_section_id
      else new.additional_profile_section_id end;
    select candidate_profile_id into v_profile_id from public.additional_profile_sections
      where id = v_section_id;
  else
    v_profile_id := case when tg_op = 'DELETE' then old.candidate_profile_id
      else new.candidate_profile_id end;
  end if;
  if v_profile_id is not null then
    update public.candidate_profiles set career_revision = career_revision + 1 where id = v_profile_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger profile_work_experiences_career_revision after insert or update or delete on public.profile_work_experiences
  for each row execute function public.bump_profile_career_revision();
create trigger profile_education_entries_career_revision after insert or update or delete on public.profile_education_entries
  for each row execute function public.bump_profile_career_revision();
create trigger profile_skills_career_revision after insert or update or delete on public.profile_skills
  for each row execute function public.bump_profile_career_revision();
create trigger profile_certifications_career_revision after insert or update or delete on public.profile_certifications
  for each row execute function public.bump_profile_career_revision();
create trigger profile_languages_career_revision after insert or update or delete on public.profile_languages
  for each row execute function public.bump_profile_career_revision();
create trigger profile_projects_career_revision after insert or update or delete on public.profile_projects
  for each row execute function public.bump_profile_career_revision();
create trigger additional_profile_sections_career_revision after insert or update or delete on public.additional_profile_sections
  for each row execute function public.bump_profile_career_revision();
create trigger additional_profile_section_items_career_revision after insert or update or delete on public.additional_profile_section_items
  for each row execute function public.bump_profile_career_revision();

create function public.apply_client_career_profile(
  p_profile_id uuid, p_actor_id uuid, p_expected_revision bigint, p_payload jsonb
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  v_revision bigint;
  v_count integer;
  v_expected integer;
  v_items jsonb;
begin
  if not exists (
    select 1 from public.user_roles where user_id = p_actor_id
      and role_code = 'client' and account_status = 'active'
      and candidate_profile_id = p_profile_id
  ) then raise exception 'Client authorization required'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or exists (select 1 from jsonb_object_keys(p_payload) as key_name(key)
      where key_name.key <> all(array['professionalSummary','workExperience','education','skills',
        'certifications','languages','projects','additionalSections']))
  then raise exception 'Invalid career payload'; end if;
  foreach v_items in array array[
    p_payload->'workExperience', p_payload->'education', p_payload->'skills',
    p_payload->'certifications', p_payload->'languages', p_payload->'projects',
    p_payload->'additionalSections'
  ] loop
    if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) > 50
    then raise exception 'Invalid career section'; end if;
  end loop;
  if jsonb_typeof(p_payload->'professionalSummary') is distinct from 'string'
    or length(p_payload->>'professionalSummary') > 10000
  then raise exception 'Invalid career summary'; end if;

  select career_revision into v_revision from public.candidate_profiles
    where id = p_profile_id and archived_at is null for update;
  if not found then raise exception 'Profile unavailable'; end if;
  if v_revision <> p_expected_revision then return null; end if;

  update public.candidate_profiles set
    professional_summary = nullif(btrim(p_payload->>'professionalSummary'), ''),
    career_revision = career_revision + 1, updated_at = now(),
    updated_by_user_id = p_actor_id
    where id = p_profile_id;

  update public.profile_work_experiences set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where candidate_profile_id = p_profile_id and archived_at is null
      and id not in (select (item->>'id')::uuid from jsonb_array_elements(p_payload->'workExperience') item);
  select count(*) into v_expected from jsonb_array_elements(p_payload->'workExperience') item
    where (item->>'changed')::boolean;
  insert into public.profile_work_experiences
    (id,candidate_profile_id,sort_order,employer_name,job_title,start_date,end_date,is_current_role,
     location,description,highlights,created_by_user_id,updated_by_user_id)
  select (item->>'id')::uuid,p_profile_id,(item->>'sortOrder')::integer,
    btrim(item->>'employerName'),btrim(item->>'jobTitle'),item->>'startDate',
    nullif(item->>'endDate',''),coalesce((item->>'currentRole')::boolean,false),
    nullif(btrim(item->>'location'),''),nullif(btrim(item->>'description'),''),
    coalesce(array(select jsonb_array_elements_text(item->'highlights')),'{}'::text[]),p_actor_id,p_actor_id
    from jsonb_array_elements(p_payload->'workExperience') item where (item->>'changed')::boolean
  on conflict (id) do update set sort_order=excluded.sort_order,employer_name=excluded.employer_name,
    job_title=excluded.job_title,start_date=excluded.start_date,end_date=excluded.end_date,
    is_current_role=excluded.is_current_role,location=excluded.location,description=excluded.description,
    highlights=excluded.highlights,archived_at=null,archived_by_user_id=null,archive_reason=null,
    updated_at=now(),updated_by_user_id=p_actor_id
  where profile_work_experiences.candidate_profile_id=p_profile_id;
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;

  update public.profile_education_entries set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where candidate_profile_id = p_profile_id and archived_at is null
      and id not in (select (item->>'id')::uuid from jsonb_array_elements(p_payload->'education') item);
  select count(*) into v_expected from jsonb_array_elements(p_payload->'education') item
    where (item->>'changed')::boolean;
  insert into public.profile_education_entries
    (id,candidate_profile_id,sort_order,institution_name,qualification,field_of_study,start_date,end_date,
     completion_year,location,grade_result,highlights,created_by_user_id,updated_by_user_id)
  select (item->>'id')::uuid,p_profile_id,(item->>'sortOrder')::integer,btrim(item->>'institutionName'),
    btrim(item->>'qualification'),nullif(btrim(item->>'fieldOfStudy'),''),nullif(item->>'startDate',''),
    nullif(item->>'endDate',''),nullif(item->>'completionYear','')::smallint,
    nullif(btrim(item->>'location'),''),nullif(btrim(item->>'gradeResult'),''),
    coalesce(array(select jsonb_array_elements_text(item->'highlights')),'{}'::text[]),p_actor_id,p_actor_id
    from jsonb_array_elements(p_payload->'education') item where (item->>'changed')::boolean
  on conflict (id) do update set sort_order=excluded.sort_order,institution_name=excluded.institution_name,
    qualification=excluded.qualification,field_of_study=excluded.field_of_study,start_date=excluded.start_date,
    end_date=excluded.end_date,completion_year=excluded.completion_year,location=excluded.location,
    grade_result=excluded.grade_result,highlights=excluded.highlights,archived_at=null,archived_by_user_id=null,
    archive_reason=null,updated_at=now(),updated_by_user_id=p_actor_id
  where profile_education_entries.candidate_profile_id=p_profile_id;
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;

  update public.profile_skills set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where candidate_profile_id = p_profile_id and archived_at is null
      and id not in (select (item->>'id')::uuid from jsonb_array_elements(p_payload->'skills') item);
  select count(*) into v_expected from jsonb_array_elements(p_payload->'skills') item
    where (item->>'changed')::boolean;
  insert into public.profile_skills(id,candidate_profile_id,sort_order,name,category,created_by_user_id,updated_by_user_id)
  select (item->>'id')::uuid,p_profile_id,(item->>'sortOrder')::integer,btrim(item->>'name'),
    nullif(btrim(item->>'category'),''),p_actor_id,p_actor_id from jsonb_array_elements(p_payload->'skills') item
    where (item->>'changed')::boolean
  on conflict (id) do update set sort_order=excluded.sort_order,name=excluded.name,category=excluded.category,
    archived_at=null,archived_by_user_id=null,archive_reason=null,updated_at=now(),updated_by_user_id=p_actor_id
  where profile_skills.candidate_profile_id=p_profile_id;
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;

  update public.profile_certifications set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where candidate_profile_id = p_profile_id and archived_at is null
      and id not in (select (item->>'id')::uuid from jsonb_array_elements(p_payload->'certifications') item);
  select count(*) into v_expected from jsonb_array_elements(p_payload->'certifications') item
    where (item->>'changed')::boolean;
  insert into public.profile_certifications
    (id,candidate_profile_id,sort_order,name,issuing_organization,issued_on,issue_year,expires_on,expiry_year,
     credential_id,credential_url,created_by_user_id,updated_by_user_id)
  select (item->>'id')::uuid,p_profile_id,(item->>'sortOrder')::integer,btrim(item->>'name'),
    btrim(item->>'issuingOrganization'),nullif(item->>'issuedOn',''),nullif(item->>'issueYear','')::smallint,
    nullif(item->>'expiresOn',''),nullif(item->>'expiryYear','')::smallint,
    nullif(btrim(item->>'credentialId'),''),nullif(btrim(item->>'credentialUrl'),''),p_actor_id,p_actor_id
    from jsonb_array_elements(p_payload->'certifications') item where (item->>'changed')::boolean
  on conflict (id) do update set sort_order=excluded.sort_order,name=excluded.name,
    issuing_organization=excluded.issuing_organization,issued_on=excluded.issued_on,issue_year=excluded.issue_year,
    expires_on=excluded.expires_on,expiry_year=excluded.expiry_year,credential_id=excluded.credential_id,
    credential_url=excluded.credential_url,archived_at=null,archived_by_user_id=null,archive_reason=null,
    updated_at=now(),updated_by_user_id=p_actor_id
  where profile_certifications.candidate_profile_id=p_profile_id;
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;

  update public.profile_languages set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where candidate_profile_id = p_profile_id and archived_at is null
      and id not in (select (item->>'id')::uuid from jsonb_array_elements(p_payload->'languages') item);
  select count(*) into v_expected from jsonb_array_elements(p_payload->'languages') item
    where (item->>'changed')::boolean;
  insert into public.profile_languages(id,candidate_profile_id,sort_order,name,proficiency,created_by_user_id,updated_by_user_id)
  select (item->>'id')::uuid,p_profile_id,(item->>'sortOrder')::integer,btrim(item->>'name'),
    nullif(item->>'proficiency','')::public.language_proficiency,p_actor_id,p_actor_id
    from jsonb_array_elements(p_payload->'languages') item where (item->>'changed')::boolean
  on conflict (id) do update set sort_order=excluded.sort_order,name=excluded.name,
    proficiency=excluded.proficiency,archived_at=null,archived_by_user_id=null,archive_reason=null,
    updated_at=now(),updated_by_user_id=p_actor_id
  where profile_languages.candidate_profile_id=p_profile_id;
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;

  update public.profile_projects set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where candidate_profile_id = p_profile_id and archived_at is null
      and id not in (select (item->>'id')::uuid from jsonb_array_elements(p_payload->'projects') item);
  select count(*) into v_expected from jsonb_array_elements(p_payload->'projects') item
    where (item->>'changed')::boolean;
  insert into public.profile_projects
    (id,candidate_profile_id,sort_order,name,role,start_date,end_date,description,highlights,technologies,url,
     created_by_user_id,updated_by_user_id)
  select (item->>'id')::uuid,p_profile_id,(item->>'sortOrder')::integer,btrim(item->>'name'),
    nullif(btrim(item->>'role'),''),nullif(item->>'startDate',''),nullif(item->>'endDate',''),
    nullif(btrim(item->>'description'),''),
    coalesce(array(select jsonb_array_elements_text(item->'highlights')),'{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(item->'technologies')),'{}'::text[]),
    nullif(btrim(item->>'url'),''),p_actor_id,p_actor_id from jsonb_array_elements(p_payload->'projects') item
    where (item->>'changed')::boolean
  on conflict (id) do update set sort_order=excluded.sort_order,name=excluded.name,role=excluded.role,
    start_date=excluded.start_date,end_date=excluded.end_date,description=excluded.description,
    highlights=excluded.highlights,technologies=excluded.technologies,url=excluded.url,
    archived_at=null,archived_by_user_id=null,archive_reason=null,updated_at=now(),updated_by_user_id=p_actor_id
  where profile_projects.candidate_profile_id=p_profile_id;
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;

  update public.additional_profile_section_items set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where archived_at is null and additional_profile_section_id in (
      select id from public.additional_profile_sections where candidate_profile_id=p_profile_id)
    and id not in (select (entry->>'id')::uuid from jsonb_array_elements(p_payload->'additionalSections') section,
      lateral jsonb_array_elements(section->'items') entry);
  update public.additional_profile_sections set archived_at = now(), archived_by_user_id = p_actor_id,
    updated_at = now(), updated_by_user_id = p_actor_id, archive_reason = 'Client removed career entry'
    where candidate_profile_id=p_profile_id and archived_at is null
      and id not in (select (item->>'id')::uuid from jsonb_array_elements(p_payload->'additionalSections') item);
  select count(*) into v_expected from jsonb_array_elements(p_payload->'additionalSections') item
    where (item->>'changed')::boolean;
  insert into public.additional_profile_sections
    (id,candidate_profile_id,sort_order,title,created_by_user_id,updated_by_user_id)
  select (item->>'id')::uuid,p_profile_id,(item->>'sortOrder')::integer,btrim(item->>'title'),p_actor_id,p_actor_id
    from jsonb_array_elements(p_payload->'additionalSections') item where (item->>'changed')::boolean
  on conflict (id) do update set sort_order=excluded.sort_order,title=excluded.title,
    archived_at=null,archived_by_user_id=null,archive_reason=null,updated_at=now(),updated_by_user_id=p_actor_id
  where additional_profile_sections.candidate_profile_id=p_profile_id;
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;
  select count(*) into v_expected from jsonb_array_elements(p_payload->'additionalSections') section,
    lateral jsonb_array_elements(section->'items') entry where (entry->>'changed')::boolean;
  insert into public.additional_profile_section_items
    (id,additional_profile_section_id,sort_order,heading,subheading,date_label,description,highlights,url,
     created_by_user_id,updated_by_user_id)
  select (entry->>'id')::uuid,(section->>'id')::uuid,(entry->>'sortOrder')::integer,
    btrim(entry->>'heading'),nullif(btrim(entry->>'subheading'),''),nullif(btrim(entry->>'dateLabel'),''),
    nullif(btrim(entry->>'description'),''),
    coalesce(array(select jsonb_array_elements_text(entry->'highlights')),'{}'::text[]),
    nullif(btrim(entry->>'url'),''),p_actor_id,p_actor_id
    from jsonb_array_elements(p_payload->'additionalSections') section,
      lateral jsonb_array_elements(section->'items') entry where (entry->>'changed')::boolean
  on conflict (id) do update set additional_profile_section_id=excluded.additional_profile_section_id,
    sort_order=excluded.sort_order,heading=excluded.heading,subheading=excluded.subheading,
    date_label=excluded.date_label,description=excluded.description,highlights=excluded.highlights,
    url=excluded.url,archived_at=null,archived_by_user_id=null,archive_reason=null,
    updated_at=now(),updated_by_user_id=p_actor_id
  where exists (select 1 from public.additional_profile_sections s
    where s.id=additional_profile_section_items.additional_profile_section_id and s.candidate_profile_id=p_profile_id);
  get diagnostics v_count = row_count;
  if v_count <> v_expected then raise exception 'Career row ownership conflict'; end if;

  select career_revision into v_revision from public.candidate_profiles where id=p_profile_id;
  return v_revision;
end $$;

revoke all on function public.apply_client_career_profile(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.apply_client_career_profile(uuid,uuid,bigint,jsonb) to service_role;
revoke all on function public.track_career_summary_change() from public,anon,authenticated;
revoke all on function public.bump_profile_career_revision() from public,anon,authenticated;

commit;
