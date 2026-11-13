-- Durable, service-role-only delivery state for client Auth invitations.
-- Existing Auth users, roles, candidate profiles, and documents are untouched.
begin;

create table public.client_onboarding_invitations (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete restrict,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  account_status text not null default 'active',
  delivery_status text not null default 'not-sent',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  last_error_code text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_onboarding_invitation_profile_unique unique (candidate_profile_id),
  constraint client_onboarding_invitation_auth_user_unique unique (auth_user_id),
  constraint client_onboarding_invitation_email_unique unique (email),
  constraint client_onboarding_invitation_email_normalized_check
    check (email = lower(btrim(email)) and length(email) between 3 and 320),
  constraint client_onboarding_invitation_delivery_status_check
    check (delivery_status in ('not-sent', 'pending', 'sent', 'failed')),
  constraint client_onboarding_invitation_account_status_check
    check (account_status in ('active', 'disabled')),
  constraint client_onboarding_invitation_attempt_count_check
    check (attempt_count between 0 and 20),
  constraint client_onboarding_invitation_error_code_check
    check (last_error_code is null or (length(last_error_code) between 1 and 80 and last_error_code ~ '^[a-z0-9-]+$')),
  constraint client_onboarding_invitation_sent_check
    check (delivery_status <> 'sent' or sent_at is not null),
  constraint client_onboarding_invitation_acceptance_check
    check (accepted_at is null or (auth_user_id is not null and sent_at is not null))
);

create index client_onboarding_invitations_status_idx
  on public.client_onboarding_invitations (delivery_status, updated_at desc);
create index client_onboarding_invitations_created_by_idx
  on public.client_onboarding_invitations (created_by_user_id);

alter table public.client_onboarding_invitations enable row level security;
revoke all on public.client_onboarding_invitations from public, anon, authenticated;
grant select, insert, update on public.client_onboarding_invitations to service_role;

comment on table public.client_onboarding_invitations is
  'Private operational ledger for Supabase Auth client invitation delivery and activation. No password or token is stored.';

commit;
