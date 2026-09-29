-- Preserve exact year-only dates and reviewed supporting text without
-- inventing a month or changing the previously applied review migration.
begin;

alter table public.profile_education_entries
  add column completion_year smallint,
  add constraint profile_education_completion_year_check check (
    (completion_year is null or completion_year between 1000 and 9999)
    and (completion_year is null or end_date is null)
  );
alter table public.profile_certifications
  add column issue_year smallint,
  add column expiry_year smallint,
  add constraint profile_certification_years_check check (
    (issue_year is null or issue_year between 1000 and 9999)
    and (expiry_year is null or expiry_year between 1000 and 9999)
    and (issue_year is null or issued_on is null)
    and (expiry_year is null or expires_on is null)
    and (issue_year is null or expiry_year is null or expiry_year >= issue_year)
  );

-- Calls the existing atomic, admin-authorized confirmation function. The
-- enhancements below execute in the same RPC transaction; any error rolls
-- back the provenance row and all canonical writes from the base function.
create function public.confirm_resume_review_v2(
  p_profile_id uuid, p_source_file_id uuid, p_extractor text,
  p_text_sha256 text, p_admin_user_id uuid, p_approved jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_review_id uuid;
  v_note text;
  v_item jsonb;
  v_fields jsonb;
  v_id uuid;
  v_employment_index integer := 0;
  v_education_index integer := 0;
  v_certification_index integer := 0;
  v_language_index integer := 0;
  v_project_index integer := 0;
  v_additional_index integer := 0;
begin
  v_review_id := public.confirm_resume_review(
    p_profile_id, p_source_file_id, p_extractor,
    p_text_sha256, p_admin_user_id, p_approved
  );
  v_note := 'Approved resume review ' || v_review_id::text || '; source file ' || p_source_file_id::text;

  for v_item in select value from jsonb_array_elements(p_approved) loop
    v_fields := v_item->'fields';
    v_id := null;
    case v_item->>'section'
      when 'employment' then
        select id into v_id from public.profile_work_experiences
          where candidate_profile_id = p_profile_id and administrative_note = v_note
          order by sort_order limit 1 offset v_employment_index;
        if v_id is null then raise exception 'Reviewed employment row unavailable'; end if;
        update public.profile_work_experiences set
          location = nullif(btrim(v_fields->>'location'), ''),
          description = nullif(btrim(v_fields->>'description'), ''),
          highlights = coalesce((
            select array_agg(btrim(bullet_line.line) order by bullet_line.ord) from
              regexp_split_to_table(coalesce(v_fields->>'highlights', ''), E'\n') with ordinality as bullet_line(line, ord)
            where btrim(bullet_line.line) <> ''
          ), '{}'::text[]),
          updated_at = now(), updated_by_user_id = p_admin_user_id
          where id = v_id;
        v_employment_index := v_employment_index + 1;
      when 'education' then
        select id into v_id from public.profile_education_entries
          where candidate_profile_id = p_profile_id and administrative_note = v_note
          order by sort_order limit 1 offset v_education_index;
        if v_id is null then raise exception 'Reviewed education row unavailable'; end if;
        update public.profile_education_entries set
          completion_year = nullif(v_fields->>'completionYear', '')::smallint,
          grade_result = nullif(btrim(v_fields->>'gradeResult'), ''),
          updated_at = now(), updated_by_user_id = p_admin_user_id
          where id = v_id;
        v_education_index := v_education_index + 1;
      when 'certifications' then
        select id into v_id from public.profile_certifications
          where candidate_profile_id = p_profile_id and administrative_note = v_note
          order by sort_order limit 1 offset v_certification_index;
        if v_id is null then raise exception 'Reviewed certification row unavailable'; end if;
        update public.profile_certifications set
          issue_year = nullif(v_fields->>'issueYear', '')::smallint,
          expiry_year = nullif(v_fields->>'expiryYear', '')::smallint,
          updated_at = now(), updated_by_user_id = p_admin_user_id
          where id = v_id;
        v_certification_index := v_certification_index + 1;
      when 'languages' then
        select id into v_id from public.profile_languages
          where candidate_profile_id = p_profile_id and administrative_note = v_note
          order by sort_order limit 1 offset v_language_index;
        if v_id is null then raise exception 'Reviewed language row unavailable'; end if;
        update public.profile_languages set
          proficiency = nullif(v_fields->>'proficiency', '')::public.language_proficiency,
          updated_at = now(), updated_by_user_id = p_admin_user_id
          where id = v_id;
        v_language_index := v_language_index + 1;
      when 'projects' then
        select id into v_id from public.profile_projects
          where candidate_profile_id = p_profile_id and administrative_note = v_note
          order by sort_order limit 1 offset v_project_index;
        if v_id is null then raise exception 'Reviewed project row unavailable'; end if;
        update public.profile_projects set
          description = nullif(btrim(v_fields->>'description'), ''),
          highlights = coalesce((
            select array_agg(btrim(bullet_line.line) order by bullet_line.ord) from
              regexp_split_to_table(coalesce(v_fields->>'highlights', ''), E'\n') with ordinality as bullet_line(line, ord)
            where btrim(bullet_line.line) <> ''
          ), '{}'::text[]),
          updated_at = now(), updated_by_user_id = p_admin_user_id
          where id = v_id;
        v_project_index := v_project_index + 1;
      when 'additional' then
        select id into v_id from public.additional_profile_sections
          where candidate_profile_id = p_profile_id and administrative_note = v_note
          order by sort_order limit 1 offset v_additional_index;
        if v_id is null then raise exception 'Reviewed additional section unavailable'; end if;
        if nullif(btrim(v_fields->>'description'), '') is not null then
          insert into public.additional_profile_section_items
            (additional_profile_section_id, sort_order, heading, description,
             created_by_user_id, updated_by_user_id, administrative_note)
          values (v_id, 0, btrim(v_fields->>'heading'), btrim(v_fields->>'description'),
                  p_admin_user_id, p_admin_user_id, v_note);
        end if;
        v_additional_index := v_additional_index + 1;
      else null;
    end case;
  end loop;
  return v_review_id;
end $$;

revoke all on function public.confirm_resume_review_v2(uuid, uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_resume_review_v2(uuid, uuid, text, text, uuid, jsonb)
  to service_role;

commit;
