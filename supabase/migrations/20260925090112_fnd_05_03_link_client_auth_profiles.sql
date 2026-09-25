begin;

alter table public.user_roles
  add column candidate_profile_id uuid,
  add column account_status text not null default 'active',
  add constraint user_roles_candidate_profile_fk
    foreign key (candidate_profile_id)
    references public.candidate_profiles (id)
    on update cascade
    on delete restrict,
  add constraint user_roles_candidate_profile_key
    unique (candidate_profile_id),
  add constraint user_roles_account_status_check
    check (account_status in ('active', 'disabled')),
  add constraint user_roles_profile_role_check
    check (
      (role_code = 'admin' and candidate_profile_id is null)
      or (role_code = 'client' and candidate_profile_id is not null)
    ) not valid;

comment on column public.user_roles.candidate_profile_id is
  'One-to-one candidate profile link required for newly provisioned client roles.';
comment on column public.user_roles.account_status is
  'Application access state enforced by server-side portal authorization.';

-- Provisioning is exclusively server-side. Browser roles retain self-read only.
grant select on table public.candidate_profiles to service_role;
grant select, insert, update, delete on table public.user_roles to service_role;

commit;
