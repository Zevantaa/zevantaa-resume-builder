# REL-01 read-only operational diagnostics

Run these queries only in a trusted Supabase SQL Editor or approved DBA connection. They report counts and controlled IDs, never CV text, passwords, object keys, or public URLs. They are **not** migrations; do not automate them in the browser. Record UTC time, project ref, operator and count results in restricted release evidence. A zero count is not a substitute for live access testing.

## Client-role hygiene

```sql
select
  count(*) filter (where role_code = 'client' and account_status = 'active'
    and candidate_profile_id is null) as active_unlinked_clients,
  count(*) filter (where role_code = 'client' and account_status = 'disabled'
    and candidate_profile_id is null) as disabled_unlinked_clients,
  count(*) filter (where role_code = 'admin' and candidate_profile_id is not null)
    as admin_profile_links
from public.user_roles;

select count(*) as duplicate_profile_link_groups
from (
  select candidate_profile_id
  from public.user_roles
  where candidate_profile_id is not null
  group by candidate_profile_id having count(*) > 1
) duplicates;

select user_id, account_status, created_at
from public.user_roles
where role_code = 'client' and candidate_profile_id is null
order by created_at;
```

The previously observed active unlinked client-role row cannot enter `/client`: `getAuthContext()` returns no usable client role without linkage. For cleanup, a privileged owner must identify the Auth account, confirm whether a candidate profile exists and is unclaimed, then **separately authorize** either a correct one-to-one link or disabling the orphan role. Preserve Auth/profile history. Do not guess a profile, delete the role, or run an UPDATE from this document. Re-run counts and direct-access denial after the authorized change. Existing unique and check constraints protect new/updated links but one historical role/profile check was added `NOT VALID`; review legacy rows explicitly.

## DOC-13 queue and integrity

```sql
select status::text, count(*) as jobs,
  count(*) filter (where attempts >= 3) as at_max_attempts,
  min(created_at) as oldest_created_at
from public.document_regeneration_jobs
group by status order by status;

select
  count(*) filter (where d.file_record_id is null or f.id is null)
    as available_documents_missing_file_record,
  count(*) filter (where f.id is not null and o.id is null)
    as available_documents_missing_storage_metadata,
  count(*) filter (where f.id is not null and
    (f.storage_bucket_name <> 'candidate-documents-private' or
     f.storage_bucket_name is null)) as wrong_generated_bucket
from public.document_records d
left join public.file_records f
  on f.id = d.file_record_id and f.candidate_profile_id = d.candidate_profile_id
left join storage.objects o
  on o.bucket_id = f.storage_bucket_name and o.name = f.storage_object_key
where d.origin = 'generated' and d.status = 'available' and d.archived_at is null;

select count(*) as duplicate_current_output_groups
from (
  select candidate_profile_id, output_kind
  from public.document_records
  where status = 'available' and output_kind is not null and archived_at is null
  group by candidate_profile_id, output_kind having count(*) > 1
) duplicates;
```

The metadata join detects some orphan references, but it cannot prove that Storage object bytes are intact or that no unreferenced Storage objects exist. Validate sampled private bytes with a trusted server read-back and checksum during live QA. Do not expose row-level object keys in an admin page or diagnostic response. Any nonzero missing-file, missing-object, wrong-bucket, or duplicate-current count blocks release until investigated. Pending/failed/max-attempt jobs require age-based triage; the request-driven worker is not an unattended scheduler.

## Database plus Storage restore preparation

Source must be a provider-confirmed backup or encrypted off-site logical PostgreSQL export covering `public`, `auth` linkage and migration history; capture backup timestamp and checksum. Independently back up private object **bytes and metadata** for `candidate-intake-private`, `candidate-documents-private`, and `zevantaa-brand-assets`, with restricted inventory/checksum manifest. A database backup alone does not contain Storage bytes. Record the Git SHA, lockfile, reviewed migration equivalence manifest, bucket policy metadata and vault recovery procedure without copying secrets into evidence.

For a final-stage timed drill, choose an **isolated non-production project**. Record approval and start UTC, restore database/Auth-dependent state, reconcile (do not blindly replay) migrations, restore private buckets and object bytes, then configure private credentials and exact Auth redirects from the vault. Deploy the matching immutable app build only to the isolated target. Record end UTC, RTO, latest restored write and RPO, errors and reviewer.

Read-only validation after restore: rerun the role and DOC-13 count queries above; compare table/row counts, FK/unique/index/RLS/policy inventory and Storage object counts/checksums to the source manifest. Then run fictional or approved-record login, admin/client denial, recovery, private download, source upload, document publication/version, and audit-write smoke checks. Verify anonymous/other-client object denial and no public bucket. Never overwrite the live project as a first drill. Use the [restore evidence template](assurance/RESTORE_DRILL_TEMPLATE.md); no drill is claimed complete here.
