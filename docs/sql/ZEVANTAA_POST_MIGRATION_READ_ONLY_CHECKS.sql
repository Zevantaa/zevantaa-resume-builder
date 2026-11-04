-- ZEVANTAA PR #1 POST-MIGRATION VERIFICATION (READ ONLY)
-- Run after all six migrations commit and before scheduler activation.

with expected(version, name) as (values
  ('20261103215458','automated_source_processing'),
  ('20261103220738','automated_resume_acceptance'),
  ('20261103221521','automated_entitlement_orchestration'),
  ('20261103222143','supabase_automation_scheduler'),
  ('20261103222518','client_resume_input_confirmation'),
  ('20261103223240','ats_assessment_provenance')
)
select e.version, e.name,
  exists (select 1 from supabase_migrations.schema_migrations m
    where m.version = e.version and m.name = e.name) as recorded
from expected e order by e.version;

select c.relname, c.relrowsecurity,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('service_role', c.oid, 'SELECT') as service_select
from pg_class c
where c.oid in (
  'public.resume_processing_jobs'::regclass,
  'public.ats_assessment_snapshots'::regclass
)
order by c.relname;

select
  has_column_privilege('service_role','public.profile_resume_reviews','review_mode','UPDATE')
    as service_can_update_review_mode,
  has_table_privilege('anon','public.resume_processing_jobs','SELECT')
    as anon_can_read_source_queue,
  has_table_privilege('authenticated','public.ats_assessment_snapshots','SELECT')
    as authenticated_can_read_ats_snapshots;

select tgname, tgrelid::regclass as relation_name, tgenabled
from pg_trigger
where not tgisinternal and tgname in (
  'candidate_profiles_enqueue_source_processing',
  'profile_resume_reviews_enqueue_outputs',
  'candidate_profiles_reconcile_package_outputs'
)
order by tgname;

select conrelid::regclass as relation_name, conname, convalidated
from pg_constraint
where conrelid in (
  'public.resume_processing_jobs'::regclass,
  'public.ats_assessment_snapshots'::regclass
)
order by conrelid::regclass::text, conname;

select extname as name, extversion
from pg_extension where extname in ('pg_cron','pg_net','supabase_vault')
order by extname;

select jobid, jobname, schedule, active
from cron.job where jobname = 'zevantaa-automation-worker';

select status::text, count(*) as source_jobs,
  count(*) filter (where attempts >= 3) as source_jobs_at_max_attempts,
  count(*) filter (where status = 'processing' and lease_until < now())
    as expired_source_leases
from public.resume_processing_jobs group by status order by status;

select status::text, count(*) as document_jobs,
  count(*) filter (where attempts >= 3) as document_jobs_at_max_attempts,
  count(*) filter (where status = 'processing' and lease_until < now())
    as expired_document_leases
from public.document_regeneration_jobs group by status order by status;

select
  count(*) filter (where content_sha256 is null) as files_without_content_hash,
  count(*) filter (where purpose = 'source-resume' and content_sha256 is null)
    as legacy_source_resumes_without_content_hash,
  count(*) filter (where purpose = 'source-resume' and content_sha256 is not null)
    as hashed_source_resumes
from public.file_records;

select review_mode, count(*) as review_count
from public.profile_resume_reviews group by review_mode order by review_mode;

select count(*) as ats_snapshot_count,
  count(*) filter (where score < 0 or score > 100 or benchmark <> 90)
    as invalid_ats_snapshot_headers
from public.ats_assessment_snapshots;

select count(*) as duplicate_source_job_groups
from (
  select candidate_profile_id, source_file_id
  from public.resume_processing_jobs
  group by candidate_profile_id, source_file_id having count(*) > 1
) duplicates;

select count(*) as duplicate_document_job_groups
from (
  select candidate_profile_id, output_kind, source_career_revision
  from public.document_regeneration_jobs
  group by candidate_profile_id, output_kind, source_career_revision
  having count(*) > 1
) duplicates;

select
  (select count(*) from public.candidate_profiles) as candidate_profiles,
  (select count(*) from public.user_roles) as user_roles,
  (select count(*) from public.file_records) as file_records,
  (select count(*) from public.profile_resume_reviews) as profile_resume_reviews,
  (select count(*) from public.document_records) as document_records;
