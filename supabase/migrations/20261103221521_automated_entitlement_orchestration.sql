-- Phase 3: enqueue the complete frozen V1 entitlement set when a reviewed
-- profile becomes ready, and reconcile package changes without deleting
-- historical documents.
begin;

create function public.is_v1_output_entitled(
  p_package public.v1_package_code,
  p_output public.generated_output_kind
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_package
    when 'indian-domestic' then p_output in (
      'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
      'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5')
    when 'gcc-middle-east' then p_output in ('global-ats-resume', 'gcc-resume')
    when 'europass-european-union' then p_output in ('global-ats-resume', 'europass-eu-resume')
    when 'domestic-gcc' then p_output in (
      'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
      'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5', 'gcc-resume')
    when 'domestic-europass-european-union' then p_output in (
      'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
      'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5', 'europass-eu-resume')
    when 'global-mobility-master' then p_output in (
      'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
      'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5',
      'gcc-resume', 'europass-eu-resume')
    when 'executive-transition-agency-distribution' then p_output in (
      'global-ats-resume', 'domestic-resume-1', 'domestic-resume-2',
      'domestic-resume-3', 'domestic-resume-4', 'domestic-resume-5',
      'gcc-resume', 'europass-eu-resume',
      'general-corporate-cover-letter', 'international-relocation-cover-letter',
      'technology-startup-cover-letter')
    else false
  end;
$$;

revoke all on function public.is_v1_output_entitled(
  public.v1_package_code, public.generated_output_kind
) from public, anon, authenticated;
grant execute on function public.is_v1_output_entitled(
  public.v1_package_code, public.generated_output_kind
) to service_role;

create function public.enqueue_entitled_document_outputs(p_profile_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile record;
  v_count integer := 0;
begin
  select p.selected_package_code, p.career_revision into v_profile
  from public.candidate_profiles p
  where p.id = p_profile_id and p.archived_at is null
  for update;
  if not found then raise exception 'Candidate profile unavailable'; end if;

  -- A persisted review is the readiness boundary. The review transaction
  -- writes canonical facts and any later career-revision trigger carries
  -- these jobs forward to the transaction's final revision.
  if not exists (
    select 1 from public.profile_resume_reviews r
    where r.candidate_profile_id = p_profile_id
  ) then return 0; end if;

  insert into public.document_regeneration_jobs
    (candidate_profile_id, output_kind, source_career_revision)
  select p_profile_id, output, v_profile.career_revision
  from unnest(enum_range(null::public.generated_output_kind)) as outputs(output)
  where public.is_v1_output_entitled(v_profile.selected_package_code, output)
    and not exists (
      select 1 from public.document_records d
      where d.candidate_profile_id = p_profile_id
        and d.output_kind = output
        and d.source_career_revision = v_profile.career_revision
        and d.status = 'available' and d.archived_at is null
    )
  on conflict (candidate_profile_id, output_kind, source_career_revision)
  do update set status = 'pending', attempts = 0, lease_token = null,
    lease_until = null, next_attempt_at = now(), last_error_code = null,
    completed_at = null, updated_at = now()
  where public.document_regeneration_jobs.status = 'failed'
    or public.document_regeneration_jobs.status = 'completed';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_entitled_document_outputs(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_entitled_document_outputs(uuid)
  to service_role;

create function public.enqueue_outputs_after_resume_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.enqueue_entitled_document_outputs(new.candidate_profile_id);
  return new;
end;
$$;

create trigger profile_resume_reviews_enqueue_outputs
after insert on public.profile_resume_reviews
for each row execute function public.enqueue_outputs_after_resume_review();

revoke all on function public.enqueue_outputs_after_resume_review()
  from public, anon, authenticated;

create function public.reconcile_outputs_after_package_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.selected_package_code = old.selected_package_code then return new; end if;

  update public.document_regeneration_jobs j
  set status = 'failed', attempts = 3, lease_token = null, lease_until = null,
      last_error_code = 'no-longer-entitled', completed_at = null, updated_at = now()
  where j.candidate_profile_id = new.id
    and j.status in ('pending', 'processing', 'failed')
    and not public.is_v1_output_entitled(new.selected_package_code, j.output_kind);

  -- Historical rows remain intact for authorized administrator review. Only
  -- their client-current state is withdrawn.
  update public.document_records d
  set status = 'outdated', updated_at = now()
  where d.candidate_profile_id = new.id and d.status = 'available'
    and d.origin = 'generated' and d.output_kind is not null
    and d.archived_at is null
    and not public.is_v1_output_entitled(new.selected_package_code, d.output_kind);

  perform public.enqueue_entitled_document_outputs(new.id);
  return new;
end;
$$;

create trigger candidate_profiles_reconcile_package_outputs
after update of selected_package_code on public.candidate_profiles
for each row when (new.selected_package_code is distinct from old.selected_package_code)
execute function public.reconcile_outputs_after_package_change();

revoke all on function public.reconcile_outputs_after_package_change()
  from public, anon, authenticated;

-- The original claim was deliberately profile-scoped. A Zevantaa-owned
-- scheduler needs a global bounded claim, while still binding each job to an
-- active linked client for provenance and rate-limiting.
drop function public.claim_document_regeneration_job(uuid);
create function public.claim_document_regeneration_job(p_profile_id uuid default null)
returns table (
  job_id uuid,
  candidate_profile_id uuid,
  output_kind public.generated_output_kind,
  source_career_revision bigint,
  lease_token uuid,
  actor_user_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.document_regeneration_jobs j
  set status = 'processing', lease_token = gen_random_uuid(),
      lease_until = now() + interval '6 minutes', attempts = j.attempts + 1,
      updated_at = now()
  where j.id = (
    select q.id
    from public.document_regeneration_jobs q
    join public.candidate_profiles p on p.id = q.candidate_profile_id
      and p.archived_at is null
    join public.user_roles r on r.candidate_profile_id = q.candidate_profile_id
      and r.role_code = 'client' and r.account_status = 'active'
    where (p_profile_id is null or q.candidate_profile_id = p_profile_id)
      and q.attempts < 3 and q.next_attempt_at <= now()
      and public.is_v1_output_entitled(p.selected_package_code, q.output_kind)
      and (q.status in ('pending', 'failed')
        or (q.status = 'processing' and q.lease_until < now()))
    order by q.next_attempt_at, q.created_at, q.id
    limit 1 for update of q skip locked
  )
  returning j.id, j.candidate_profile_id, j.output_kind,
    j.source_career_revision, j.lease_token,
    (select r.user_id from public.user_roles r
      where r.candidate_profile_id = j.candidate_profile_id
        and r.role_code = 'client' and r.account_status = 'active'
      order by r.created_at, r.user_id limit 1)
  into job_id, candidate_profile_id, output_kind,
    source_career_revision, lease_token, actor_user_id;
  if job_id is not null then return next; end if;
end;
$$;

create index document_regeneration_jobs_global_claim_idx
  on public.document_regeneration_jobs (next_attempt_at, created_at, id)
  where status in ('pending', 'failed', 'processing') and attempts < 3;

revoke all on function public.claim_document_regeneration_job(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_document_regeneration_job(uuid)
  to service_role;

commit;
