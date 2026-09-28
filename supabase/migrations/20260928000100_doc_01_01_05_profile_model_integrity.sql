-- DOC-01-01 through DOC-01-05: extend the existing FND-03 canonical profile.
-- No parallel resume-data tables, ownership changes, or RLS changes.
begin;

alter table public.profile_education_entries
  add column grade_result text;

-- YearMonth values are stored as YYYY-MM text in the existing schema.
-- Zero-padded months make lexical comparison equivalent to month ordering.
alter table public.profile_work_experiences
  add constraint profile_work_experiences_months_check
  check (
    start_date ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    and (end_date is null or end_date ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    and (end_date is null or end_date collate "C" >= start_date collate "C")
  );

alter table public.profile_education_entries
  add constraint profile_education_entries_months_check
  check (
    (start_date is null or start_date ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    and (end_date is null or end_date ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    and (start_date is null or end_date is null or end_date collate "C" >= start_date collate "C")
  );

alter table public.profile_certifications
  add constraint profile_certifications_months_check
  check (
    (issued_on is null or issued_on ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    and (expires_on is null or expires_on ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    and (issued_on is null or expires_on is null or expires_on collate "C" >= issued_on collate "C")
  );

comment on column public.profile_work_experiences.description is
  'Candidate-supplied role narrative and responsibilities; not generated claims.';
comment on column public.profile_work_experiences.highlights is
  'Candidate-supplied achievement bullets; not generated claims.';
comment on column public.profile_education_entries.grade_result is
  'Optional candidate-supplied grade, classification, GPA, or result.';

commit;
