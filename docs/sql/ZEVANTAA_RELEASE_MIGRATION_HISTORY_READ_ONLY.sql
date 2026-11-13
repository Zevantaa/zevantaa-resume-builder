-- Migration versions only; no SQL bodies or application data are returned.
select jsonb_build_object(
  'versions', coalesce(jsonb_agg(version order by version), '[]'::jsonb)
) as release_snapshot
from supabase_migrations.schema_migrations;
