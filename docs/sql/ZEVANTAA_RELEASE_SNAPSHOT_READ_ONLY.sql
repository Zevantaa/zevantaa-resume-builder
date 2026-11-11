-- Aggregate-only release snapshot. This intentionally returns no candidate
-- identifiers, contact details, object names, document text, or secret values.
select jsonb_build_object(
  'auth_users', (select count(*) from auth.users),
  'role_assignments', (select count(*) from public.user_roles),
  'administrator_roles', (select count(*) from public.user_roles where role_code = 'admin'),
  'candidate_profiles', (select count(*) from public.candidate_profiles),
  'file_records', (select count(*) from public.file_records),
  'document_records', (select count(*) from public.document_records),
  'document_jobs', (select count(*) from public.document_regeneration_jobs),
  'source_jobs', case when to_regclass('public.resume_processing_jobs') is null then null
    else (select count(*) from public.resume_processing_jobs) end,
  'ats_snapshots', case when to_regclass('public.ats_assessment_snapshots') is null then null
    else (select count(*) from public.ats_assessment_snapshots) end
) as release_snapshot;
