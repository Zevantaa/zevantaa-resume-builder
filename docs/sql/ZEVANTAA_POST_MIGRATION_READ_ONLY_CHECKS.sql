-- ZEVANTAA PR #1 POST-MIGRATION VERIFICATION (READ ONLY)
-- Run after the six automation migrations and both approved forward migrations
-- commit, and before scheduler activation.

with expected(version, name) as (values
  ('20261103215458','automated_source_processing'),
  ('20261103220738','automated_resume_acceptance'),
  ('20261103221521','automated_entitlement_orchestration'),
  ('20261103222143','supabase_automation_scheduler'),
  ('20261103222518','client_resume_input_confirmation'),
  ('20261103223240','ats_assessment_provenance'),
  ('20261111085249','client_onboarding_invitation_state'),
  ('20261113052443','complete_client_experience_admin_ats')
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
  'public.ats_assessment_snapshots'::regclass,
  'public.client_lifecycle_events'::regclass,
  'public.client_permanent_deletion_requests'::regclass,
  'public.document_ats_assessments'::regclass
)
order by c.relname;

select
  has_column_privilege('service_role','public.profile_resume_reviews','review_mode','UPDATE')
    as service_can_update_review_mode,
  has_table_privilege('anon','public.resume_processing_jobs','SELECT')
    as anon_can_read_source_queue,
  has_table_privilege('authenticated','public.ats_assessment_snapshots','SELECT')
    as authenticated_can_read_ats_snapshots,
  has_table_privilege('anon','public.document_ats_assessments','SELECT')
    as anon_can_read_document_ats,
  has_table_privilege('authenticated','public.document_ats_assessments','SELECT')
    as authenticated_can_read_document_ats,
  has_table_privilege('service_role','public.document_ats_assessments','SELECT,INSERT,UPDATE,DELETE')
    as service_can_manage_document_ats;

select tgname, tgrelid::regclass as relation_name, tgenabled
from pg_trigger
where not tgisinternal and tgname in (
  'candidate_profiles_enqueue_source_processing',
  'profile_resume_reviews_enqueue_outputs',
  'candidate_profiles_reconcile_package_outputs',
  'file_records_enqueue_document_ats_assessment',
  'document_records_enqueue_document_ats_assessment'
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

select status::text, count(*) as document_ats_assessments,
  count(*) filter (where status = 'processing' and lease_until < now())
    as expired_document_ats_leases,
  count(*) filter (where status = 'ready' and (score is null or score < 0 or score > 100))
    as invalid_ready_scores,
  count(*) filter (where status <> 'ready' and score is not null)
    as scores_outside_ready_state
from public.document_ats_assessments
group by status order by status;

select
  count(*) filter (where role_code = 'admin' and is_active) as active_administrators,
  count(*) filter (where role_code = 'client' and is_active) as active_clients,
  count(*) filter (where role_code = 'client' and not is_active) as inactive_clients
from public.user_roles;

select
  count(*) filter (where archived_at is not null and client_recovery_until is null)
    as archived_profiles_without_recovery_window,
  count(*) filter (where archived_at is null and client_recovery_until is not null)
    as active_profiles_with_recovery_window
from public.candidate_profiles;

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
