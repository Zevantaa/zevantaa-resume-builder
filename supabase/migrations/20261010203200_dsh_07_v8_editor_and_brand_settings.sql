-- DSH-07: additive v8 career metadata, shared skill names, and controlled branding.
-- Prepared for review. Do not apply remotely as part of the UI implementation.
begin;

alter table public.profile_work_experiences
  alter column start_date drop not null,
  add column employment_type text check (employment_type in
    ('full-time','part-time','contract','internship','freelance','other'));

alter table public.profile_education_entries
  add column mode_of_study text check (mode_of_study in ('offline','online','hybrid','correspondence')),
  add column start_year smallint check (start_year between 1000 and 9999),
  add column end_year smallint check (end_year between 1000 and 9999),
  add column is_current_study boolean not null default false,
  add constraint profile_education_v8_years_check check (
    (start_year is null or end_year is null or end_year >= start_year)
    and (not is_current_study or (end_year is null and end_date is null and completion_year is null))
  );

alter table public.profile_certifications
  add column validity_status text check (validity_status in ('until-date','no-expiry','unknown')),
  add column issued_exact_on date,
  add column expires_exact_on date,
  add constraint profile_certifications_v8_exact_dates_check check (
    (issued_exact_on is null or (issued_on is null and issue_year is null))
    and (expires_exact_on is null or (expires_on is null and expiry_year is null))
    and (validity_status is distinct from 'until-date' or expires_exact_on is not null)
    and (validity_status is null or validity_status <> 'no-expiry' or
      (expires_exact_on is null and expires_on is null and expiry_year is null))
    and (issued_exact_on is null or expires_exact_on is null or expires_exact_on >= issued_exact_on)
  );

alter table public.profile_projects
  add column is_ongoing boolean not null default false,
  add constraint profile_projects_v8_ongoing_check check (not is_ongoing or end_date is null);

create table public.skill_library (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(btrim(canonical_name)) between 1 and 200),
  normalized_key text not null unique check (length(normalized_key) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.skill_library enable row level security;
revoke all on public.skill_library from public, anon, authenticated;
grant all on public.skill_library to service_role;
create index skill_library_name_search_idx on public.skill_library (lower(canonical_name));

-- Existing reviewed profile skills are a safe initial vocabulary. Profile rows
-- stay in place; this is only a reusable name index, with known Excel aliases.
insert into public.skill_library (canonical_name, normalized_key)
select distinct on (normalized_key)
  case when normalized_key='microsoft-excel' then 'Microsoft Excel' else name end,
  normalized_key
from (
  select btrim(name) as name,
    case when regexp_replace(lower(btrim(name)),'[^a-z0-9]','','g')
      in ('excel','msexcel','microsoftexcel') then 'microsoft-excel'
    else trim(both '-' from regexp_replace(lower(btrim(name)),'[^[:alnum:]]+','-','g')) end as normalized_key
  from public.profile_skills where archived_at is null
) names
where name <> '' and normalized_key <> ''
order by normalized_key, name
on conflict (normalized_key) do nothing;

-- One approved settings row; candidate files remain in their separate private bucket.
create table public.app_brand_settings (
  id text primary key default 'default' check (id = 'default'),
  logo_object_key text,
  mark_object_key text,
  ui_font text not null default 'inter' check (ui_font in ('inter','arial','segoe-ui','verdana')),
  heading_font text not null default 'inter' check (heading_font in ('inter','arial','segoe-ui','verdana','georgia')),
  accent_color text not null default '#0fa36f' check (accent_color in ('#0fa36f','#3568f0','#d6a32d','#6d4bd1')),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid
);
alter table public.app_brand_settings enable row level security;
revoke all on public.app_brand_settings from public, anon, authenticated;
grant all on public.app_brand_settings to service_role;
insert into public.app_brand_settings (id) values ('default');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zevantaa-brand-assets', 'zevantaa-brand-assets', false, 2097152,
  array['image/png','image/webp','image/x-icon','image/vnd.microsoft.icon'])
on conflict (id) do nothing;
-- No browser storage policies: only the trusted server may write or download.

-- The existing DSH-06 function still handles every canonical career row atomically.
-- This wrapper adds only the newly approved columns and skill-library learning in
-- the SAME transaction. An exception rolls back the underlying canonical save.
create function public.apply_client_career_profile_v8(
  p_profile_id uuid, p_actor_id uuid, p_expected_revision bigint, p_payload jsonb
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint; v_work jsonb; v_legacy_payload jsonb;
begin
  -- DSH-06 btrim('') would violate the date check; omit the key for an
  -- intentionally blank optional start month so its insert stores NULL.
  select coalesce(jsonb_agg(case when item->>'startDate'='' then item-'startDate' else item end), '[]'::jsonb)
    into v_work from jsonb_array_elements(p_payload->'workExperience') item;
  v_legacy_payload := jsonb_set(p_payload,'{workExperience}',v_work);
  v_revision := public.apply_client_career_profile(p_profile_id, p_actor_id, p_expected_revision, v_legacy_payload);
  if v_revision is null then return null; end if;

  update public.profile_work_experiences w set employment_type = nullif(item->>'employmentType','')
  from jsonb_array_elements(p_payload->'workExperience') item
  where w.id=(item->>'id')::uuid and w.candidate_profile_id=p_profile_id and w.archived_at is null
    and w.employment_type is distinct from nullif(item->>'employmentType','');

  update public.profile_education_entries e set
    mode_of_study=nullif(item->>'modeOfStudy',''),
    start_year=nullif(item->>'startYear','')::smallint,
    end_year=nullif(item->>'endYear','')::smallint,
    is_current_study=coalesce((item->>'currentStudy')::boolean,false)
  from jsonb_array_elements(p_payload->'education') item
  where e.id=(item->>'id')::uuid and e.candidate_profile_id=p_profile_id and e.archived_at is null
    and (e.mode_of_study,e.start_year,e.end_year,e.is_current_study) is distinct from
      (nullif(item->>'modeOfStudy',''),nullif(item->>'startYear','')::smallint,
       nullif(item->>'endYear','')::smallint,coalesce((item->>'currentStudy')::boolean,false));

  update public.profile_certifications c set
    validity_status=nullif(item->>'validityStatus',''),
    issued_exact_on=nullif(item->>'issuedExactOn','')::date,
    expires_exact_on=nullif(item->>'expiresExactOn','')::date
  from jsonb_array_elements(p_payload->'certifications') item
  where c.id=(item->>'id')::uuid and c.candidate_profile_id=p_profile_id and c.archived_at is null
    and (c.validity_status,c.issued_exact_on,c.expires_exact_on) is distinct from
      (nullif(item->>'validityStatus',''),nullif(item->>'issuedExactOn','')::date,
       nullif(item->>'expiresExactOn','')::date);

  update public.profile_projects p set is_ongoing=coalesce((item->>'ongoing')::boolean,false)
  from jsonb_array_elements(p_payload->'projects') item
  where p.id=(item->>'id')::uuid and p.candidate_profile_id=p_profile_id and p.archived_at is null
    and p.is_ongoing is distinct from coalesce((item->>'ongoing')::boolean,false);

  insert into public.skill_library (canonical_name, normalized_key)
  select distinct on (normalized_key)
    case when normalized_key='microsoft-excel' then 'Microsoft Excel' else name end,
    normalized_key
  from (
    select btrim(item->>'name') as name,
      case when regexp_replace(lower(btrim(item->>'name')),'[^a-z0-9]','','g')
        in ('excel','msexcel','microsoftexcel') then 'microsoft-excel'
      else trim(both '-' from regexp_replace(lower(btrim(item->>'name')),'[^[:alnum:]]+','-','g')) end as normalized_key
    from jsonb_array_elements(p_payload->'skills') item
  ) names
  where name <> '' and normalized_key <> ''
  order by normalized_key, name
  on conflict (normalized_key) do nothing;

  select career_revision into v_revision from public.candidate_profiles where id=p_profile_id;
  return v_revision;
end $$;
revoke all on function public.apply_client_career_profile_v8(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.apply_client_career_profile_v8(uuid,uuid,bigint,jsonb) to service_role;

commit;
