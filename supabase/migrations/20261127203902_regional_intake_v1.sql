-- Additive, client-confirmed regional facts for the existing eleven V1 outputs.
-- Apply only after the previously reviewed migrations, backup and schema preflight.
begin;

alter table public.candidate_profiles
  add column regional_intake jsonb not null default '{}'::jsonb,
  add column regional_intake_confirmed_at timestamptz,
  add column gcc_photo_consent_at timestamptz,
  add constraint candidate_profiles_regional_intake_shape check (
    jsonb_typeof(regional_intake) = 'object'
    and octet_length(regional_intake::text) <= 40000
  );

-- The server validates the full v1 payload. This transaction independently
-- enforces size, top-level shape, active ownership and optimistic revision.
-- No browser role receives direct table or RPC access.
create function public.apply_client_regional_intake_v1(
  p_profile_id uuid,
  p_actor_id uuid,
  p_expected_revision bigint,
  p_payload jsonb
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint;
begin
  if p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 40000
    or exists (
      select 1 from jsonb_object_keys(p_payload) as k(key)
      where k.key not in ('version', 'global', 'gcc', 'eu')
    )
    or p_payload->>'version' is distinct from '1'
    or (p_payload ? 'global' and jsonb_typeof(p_payload->'global') <> 'object')
    or (p_payload ? 'gcc' and jsonb_typeof(p_payload->'gcc') <> 'object')
    or (p_payload ? 'eu' and jsonb_typeof(p_payload->'eu') <> 'object')
  then raise exception 'Invalid regional intake'; end if;

  select p.career_revision into v_revision
  from public.candidate_profiles p
  join public.user_roles r on r.candidate_profile_id = p.id
    and r.user_id = p_actor_id and r.role_code = 'client'
    and r.account_status = 'active'
  where p.id = p_profile_id and p.archived_at is null
  for update of p;
  if not found then raise exception 'Linked active client profile unavailable'; end if;
  if v_revision <> p_expected_revision then return null; end if;

  update public.candidate_profiles set
    regional_intake = p_payload,
    -- Explicitly name career_revision in SET: the existing AFTER UPDATE OF
    -- career_revision lifecycle trigger then invalidates stale documents and
    -- enqueues the entitled outputs exactly once for the new revision.
    career_revision = career_revision + case
      when regional_intake is distinct from p_payload then 1 else 0 end,
    regional_intake_confirmed_at = now(),
    gcc_photo_consent_at = case when p_payload #>> '{gcc,photoConsent}' = 'true'
      then coalesce(gcc_photo_consent_at, now()) else null end,
    updated_by_user_id = p_actor_id,
    updated_at = now()
  where id = p_profile_id and archived_at is null;
  if not found then raise exception 'Regional intake could not be saved'; end if;
  select career_revision into v_revision from public.candidate_profiles where id = p_profile_id;
  return v_revision;
end;
$$;

revoke all on function public.apply_client_regional_intake_v1(uuid,uuid,bigint,jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_client_regional_intake_v1(uuid,uuid,bigint,jsonb)
  to service_role;

commit;
