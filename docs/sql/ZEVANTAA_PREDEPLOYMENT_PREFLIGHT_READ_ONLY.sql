-- ZEVANTAA PR #1 PRE-DEPLOYMENT PREFLIGHT (READ ONLY)
-- Target project: fzltowzpfrnuxxxrzuih
-- Run before applying any PR #1 migration. Save the complete result as
-- restricted release evidence. This script returns counts and metadata only.

select current_database() as database_name,
  current_setting('server_version') as postgres_version,
  now() at time zone 'utc' as checked_at_utc;

with expected(version, name) as (values
  ('20260917000100','fnd_03_06_initial_v1_schema'),
  ('20260918042037','fnd_03_07_relationships_and_constraints'),
  ('20260918044133','fnd_03_07_cover_composite_foreign_keys'),
  ('20260925084040','fnd_04_07_08_user_roles'),
  ('20260925090112','fnd_05_03_link_client_auth_profiles'),
  ('20260927204914','fnd_06_08_09_private_intake_bucket'),
  ('20260928000100','doc_01_01_05_profile_model_integrity'),
  ('20260929000100','admin_owned_profile_onboarding'),
  ('20260929000200','doc_02_05_06_review_confirmation'),
  ('20260929000300','doc_02_06_live_parser_fields'),
  ('20261010184016','dsh_06_dynamic_career_updates'),
  ('20261010203200','dsh_07_v8_editor_and_brand_settings'),
  ('20261010212007','sec_01_least_privilege_and_audit'),
  ('20261023190731','doc_13_persistent_documents'),
  ('20261023190738','doc_13_document_lifecycle')
)
select e.version as expected_version, e.name as expected_name,
  m.version as recorded_version, m.name as recorded_name,
  case when m.version is null then 'MISSING' else 'PRESENT' end as result
from expected e
left join supabase_migrations.schema_migrations m
  on m.version = e.version and m.name = e.name
order by e.version;

select version, name
from supabase_migrations.schema_migrations
order by version;

with proposed(version, name) as (values
  ('20261103215458','automated_source_processing'),
  ('20261103220738','automated_resume_acceptance'),
  ('20261103221521','automated_entitlement_orchestration'),
  ('20261103222143','supabase_automation_scheduler'),
  ('20261103222518','client_resume_input_confirmation'),
  ('20261103223240','ats_assessment_provenance')
)
select p.version, p.name,
  exists (select 1 from supabase_migrations.schema_migrations m
    where m.version = p.version or m.name = p.name) as already_recorded
from proposed p order by p.version;

select
  to_regclass('public.candidate_profiles') is not null as candidate_profiles_present,
  to_regclass('public.file_records') is not null as file_records_present,
  to_regclass('public.profile_resume_reviews') is not null as reviews_present,
  to_regclass('public.document_records') is not null as documents_present,
  to_regclass('public.document_regeneration_jobs') is not null as document_jobs_present,
  to_regtype('public.v1_package_code') is not null as package_enum_present,
  to_regtype('public.generated_output_kind') is not null as output_enum_present,
  to_regprocedure('public.confirm_resume_review(uuid,uuid,text,text,uuid,jsonb)') is not null
    as base_review_rpc_present,
  to_regprocedure('public.confirm_resume_review_v2(uuid,uuid,text,text,uuid,jsonb)') is not null
    as v2_review_rpc_present,
  to_regprocedure('public.claim_document_regeneration_job(uuid)') is not null
    as document_claim_rpc_present;

select t.typname,
  string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels
from pg_type t join pg_enum e on e.enumtypid = t.oid
where t.typnamespace = 'public'::regnamespace
  and t.typname in ('v1_package_code','generated_output_kind')
group by t.typname order by t.typname;

select name, installed_version, default_version
from pg_available_extensions
where name in ('pg_cron','pg_net','supabase_vault')
order by name;

select tgname, tgrelid::regclass as relation_name, tgenabled
from pg_trigger
where not tgisinternal and tgname in (
  'candidate_profiles_enqueue_source_processing',
  'profile_resume_reviews_enqueue_outputs',
  'candidate_profiles_reconcile_package_outputs'
)
order by tgname;

select
  to_regclass('public.resume_processing_jobs') is null as source_queue_absent,
  to_regclass('public.ats_assessment_snapshots') is null as ats_snapshots_absent,
  to_regtype('public.resume_processing_status') is null as source_status_enum_absent;

select
  (select count(*) from public.candidate_profiles) as candidate_profiles,
  (select count(*) from public.user_roles) as user_roles,
  (select count(*) from public.file_records) as file_records,
  (select count(*) from public.profile_resume_reviews) as profile_resume_reviews,
  (select count(*) from public.document_records) as document_records,
  (select count(*) from public.document_regeneration_jobs) as document_jobs;

select purpose::text, status::text, count(*) as file_count
from public.file_records group by purpose, status order by purpose, status;

select origin::text, status::text, count(*) as document_count
from public.document_records group by origin, status order by origin, status;

select count(*) as invalid_current_source_links
from public.candidate_profiles p
left join public.file_records f
  on f.id = p.existing_resume_file_id and f.candidate_profile_id = p.id
where p.existing_resume_file_id is not null and (
  f.id is null or f.purpose <> 'source-resume' or f.access_level <> 'private'
  or f.storage_bucket_name <> 'candidate-intake-private'
);

select count(*) as generated_documents_missing_file_record
from public.document_records d
left join public.file_records f
  on f.id = d.file_record_id and f.candidate_profile_id = d.candidate_profile_id
where d.origin = 'generated' and d.file_record_id is not null and f.id is null;

select count(*) as duplicate_active_client_profile_links
from (
  select candidate_profile_id
  from public.user_roles
  where role_code = 'client' and account_status = 'active'
    and candidate_profile_id is not null
  group by candidate_profile_id having count(*) > 1
) duplicates;

select count(*) as duplicate_current_output_groups
from (
  select candidate_profile_id, output_kind
  from public.document_records
  where status = 'available' and archived_at is null and output_kind is not null
  group by candidate_profile_id, output_kind having count(*) > 1
) duplicates;

select conrelid::regclass as relation_name, conname, contype, convalidated
from pg_constraint
where conrelid in (
  'public.candidate_profiles'::regclass,
  'public.file_records'::regclass,
  'public.profile_resume_reviews'::regclass,
  'public.document_records'::regclass,
  'public.document_regeneration_jobs'::regclass
)
and not convalidated
order by conrelid::regclass::text, conname;
