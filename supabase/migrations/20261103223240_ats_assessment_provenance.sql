-- Phase 6: immutable, versioned provenance for genuine indicative ATS
-- calculations. No candidate prose or document bytes are stored here.
begin;

create table public.ats_assessment_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete restrict,
  career_revision bigint not null check (career_revision >= 0),
  algorithm_version text not null check (algorithm_version = 'zevantaa-indicative-ats-v1'),
  score integer not null check (score between 0 and 100),
  benchmark integer not null check (benchmark = 90),
  breakdown jsonb not null check (
    jsonb_typeof(breakdown) = 'array'
    and jsonb_array_length(breakdown) = 8
    and pg_column_size(breakdown) <= 32768
  ),
  assessed_at timestamptz not null default now(),
  unique (candidate_profile_id, career_revision, algorithm_version)
);

create index ats_assessment_snapshots_history_idx
  on public.ats_assessment_snapshots
    (candidate_profile_id, algorithm_version, career_revision desc);

alter table public.ats_assessment_snapshots enable row level security;
revoke all on public.ats_assessment_snapshots from public, anon, authenticated;
grant select, insert on public.ats_assessment_snapshots to service_role;

create function public.record_ats_assessment_snapshot(
  p_profile_id uuid,
  p_career_revision bigint,
  p_algorithm_version text,
  p_score integer,
  p_benchmark integer,
  p_breakdown jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing record;
begin
  if p_algorithm_version <> 'zevantaa-indicative-ats-v1'
      or p_score not between 0 and 100 or p_benchmark <> 90
      or jsonb_typeof(p_breakdown) <> 'array'
      or jsonb_array_length(p_breakdown) <> 8
      or pg_column_size(p_breakdown) > 32768
      or (select count(distinct item->>'dimension') from jsonb_array_elements(p_breakdown) item) <> 8
      or exists (
        select 1 from jsonb_array_elements(p_breakdown) item
        where item->>'dimension' not in (
          'contact','summary','experience','education','skills','formatting','dates','optionalDepth')
          or jsonb_typeof(item->'score') <> 'number'
          or jsonb_typeof(item->'maximum') <> 'number'
          or (item->>'score')::integer < 0
          or (item->>'score')::integer > (item->>'maximum')::integer
      )
      or (select sum((item->>'score')::integer) from jsonb_array_elements(p_breakdown) item) <> p_score
      or (select sum((item->>'maximum')::integer) from jsonb_array_elements(p_breakdown) item) <> 100 then
    raise exception 'Invalid ATS assessment provenance';
  end if;

  perform 1 from public.candidate_profiles p
  where p.id = p_profile_id and p.career_revision = p_career_revision
    and p.archived_at is null
  for share;
  if not found then raise exception 'ATS assessment revision is stale'; end if;

  select id, score, benchmark, breakdown into v_existing
  from public.ats_assessment_snapshots
  where candidate_profile_id = p_profile_id
    and career_revision = p_career_revision
    and algorithm_version = p_algorithm_version;
  if found then
    if v_existing.score <> p_score or v_existing.benchmark <> p_benchmark
        or v_existing.breakdown <> p_breakdown then
      raise exception 'ATS assessment is non-deterministic for this revision';
    end if;
    return v_existing.id;
  end if;

  insert into public.ats_assessment_snapshots
    (candidate_profile_id, career_revision, algorithm_version, score, benchmark, breakdown)
  values (p_profile_id, p_career_revision, p_algorithm_version, p_score, p_benchmark, p_breakdown)
  on conflict (candidate_profile_id, career_revision, algorithm_version) do nothing
  returning id into v_id;
  if v_id is null then
    select id, score, benchmark, breakdown into v_existing
    from public.ats_assessment_snapshots
    where candidate_profile_id = p_profile_id
      and career_revision = p_career_revision
      and algorithm_version = p_algorithm_version;
    if not found or v_existing.score <> p_score or v_existing.benchmark <> p_benchmark
        or v_existing.breakdown <> p_breakdown then
      raise exception 'Concurrent ATS assessment is non-deterministic for this revision';
    end if;
    return v_existing.id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_ats_assessment_snapshot(
  uuid,bigint,text,integer,integer,jsonb
) from public, anon, authenticated;
grant execute on function public.record_ats_assessment_snapshot(
  uuid,bigint,text,integer,integer,jsonb
) to service_role;

commit;
