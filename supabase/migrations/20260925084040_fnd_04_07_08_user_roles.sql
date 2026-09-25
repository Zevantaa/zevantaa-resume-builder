-- FND-04-07 / FND-04-08: authoritative application role mapping.
-- Role assignments are administered through trusted server/dashboard paths;
-- authenticated browser clients can read only their own assignment.

create table public.user_roles (
  user_id uuid primary key,
  role_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_roles_user_fk
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint user_roles_role_code_check
    check (role_code in ('admin', 'client')),
  constraint user_roles_timestamp_order_check
    check (updated_at >= created_at)
);

comment on table public.user_roles is
  'Server-authoritative V1 application roles mapped one-to-one to Supabase Auth users.';
comment on column public.user_roles.role_code is
  'Frozen V1 role: admin or client.';

alter table public.user_roles enable row level security;

revoke all on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;

create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);
