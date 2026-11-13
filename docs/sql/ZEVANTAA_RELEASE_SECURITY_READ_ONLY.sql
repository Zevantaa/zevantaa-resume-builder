-- Aggregate security posture only. No object key, candidate identifier, policy
-- expression, decrypted Vault value, or credential is returned.
select jsonb_build_object(
  'private_bucket_count', (
    select count(*) from storage.buckets
    where id in (
      'candidate-intake-private',
      'candidate-documents-private',
      'zevantaa-brand-assets'
    ) and public is false
  ),
  'unexpected_public_bucket_count', (
    select count(*) from storage.buckets
    where id in (
      'candidate-intake-private',
      'candidate-documents-private',
      'zevantaa-brand-assets'
    ) and public is true
  ),
  'storage_objects_rls_enabled', (
    select relrowsecurity from pg_class
    where oid = 'storage.objects'::regclass
  ),
  'browser_can_read_source_queue', has_table_privilege('authenticated', 'public.resume_processing_jobs', 'select'),
  'browser_can_read_ats_snapshots', has_table_privilege('authenticated', 'public.ats_assessment_snapshots', 'select'),
  'anonymous_can_read_source_queue', has_table_privilege('anon', 'public.resume_processing_jobs', 'select'),
  'anonymous_can_read_ats_snapshots', has_table_privilege('anon', 'public.ats_assessment_snapshots', 'select'),
  'administrator_count', (select count(*) from public.user_roles where role_code = 'admin'),
  'active_client_count', (select count(*) from public.user_roles where role_code = 'client' and account_status = 'active')
) as release_snapshot;
