# Supabase authentication configuration

This application uses Supabase Auth for the frozen V1 administrator and client
email/password login flows. The repository contains no credentials and creates
no authentication users automatically.

## Local environment

Copy `.env.example` to `.env.local` and set these public project values from the
Supabase project **Connect** dialog or **Project Settings > API** page:

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the public publishable key.

Projects that still expose the legacy public anon key may set
`NEXT_PUBLIC_SUPABASE_ANON_KEY` instead. The publishable key takes precedence
when both variables are present. Never put a secret key or `service_role` key in
a `NEXT_PUBLIC_` variable.

The protected client-provisioning service additionally requires one server-only
administrative key:

- `SUPABASE_SECRET_KEY`: the current Supabase secret key (preferred).
- `SUPABASE_SERVICE_ROLE_KEY`: optional legacy fallback.

Set only one on the application server. Never expose either in browser code,
commit it, or give it a `NEXT_PUBLIC_` prefix.

## Required Supabase dashboard settings

1. In **Authentication > Providers > Email**, enable email and password sign-in.
2. In **Authentication > Settings**, disable new-user sign-ups. This enforces the
   V1 rule that there is no public or self-registration flow.
3. Keep anonymous sign-ins disabled.
4. In **Authentication > URL Configuration**, set the Site URL to the deployed
   application origin. Use `http://localhost:3000` for local development.
5. Create the single master administrator account through the protected Supabase
   dashboard. Do not store its password in source control or environment files.

## Password recovery redirect URLs

Password recovery uses the Supabase PKCE flow and returns through the application
callback before the user sets a new password. Add these exact local URLs under
**Authentication > URL Configuration > Redirect URLs**:

- `http://localhost:3000/auth/callback?portal=admin`
- `http://localhost:3000/auth/callback?portal=client`

Add the same two paths for the production HTTPS origin. Prefer exact production
URLs rather than broad wildcard entries. If the recovery email template has been
customized, verify that its recovery link honors Supabase's `RedirectTo` value.
The hosted default email service is suitable only for limited testing; configure
production SMTP before relying on recovery emails operationally.

The application exchanges the one-time PKCE code on the server, stores the
resulting session in Supabase-managed cookies, and then sends the user to
`/reset-password`. Recovery codes are not logged or stored by the application.

Client users are not created by this batch. They will be provisioned through the
future administrator workflow; dashboard-created fictional users may be used for
manual login testing in the meantime.

## Application role assignments

Apply the FND-04-07/FND-04-08 migration before testing protected routes. It
creates `public.user_roles`, which maps each Supabase Auth user to exactly one
frozen V1 application role: `admin` or `client`.

The portal query parameter is never used as authorization. Protected layouts
verify the Supabase session and read the user's own database role through RLS.
Authenticated browser users have read-only access to their own role row and
cannot insert, change, or delete role assignments.

After applying the migration, assign the existing master administrator from the
Supabase SQL Editor:

```sql
insert into public.user_roles (user_id, role_code)
select id, 'admin'
from auth.users
where lower(email) = lower('tech@sofiology.com')
on conflict (user_id) do update
set role_code = excluded.role_code,
    updated_at = now();
```

New clients should be created at `/admin/clients/new`. If a test client predates
this workflow, link its existing role to its candidate profile from the SQL
Editor by replacing both placeholders:

```sql
update public.user_roles as role
set candidate_profile_id = '00000000-0000-0000-0000-000000000000'::uuid,
    account_status = 'active',
    updated_at = now()
from auth.users as auth_user
where role.user_id = auth_user.id
  and lower(auth_user.email) = lower('test-client@example.invalid')
  and role.role_code = 'client';
```

Verify both assignments without exposing credentials:

```sql
select u.email, r.role_code, r.account_status, r.candidate_profile_id
from auth.users as u
join public.user_roles as r on r.user_id = u.id
where lower(u.email) in (
  lower('tech@sofiology.com'),
  lower('test-client@example.invalid')
)
order by u.email;
```

These statements must be run only from the trusted Supabase SQL Editor or a
protected provisioning service. No secret or service-role key is used by the
browser application.

## Client account provisioning

Apply the FND-05-03 migration before opening `/admin/clients/new`. The migration
adds the one-to-one candidate link and account status to `public.user_roles`.
Its role/profile check is `NOT VALID` so a pre-existing unlinked test-client row
does not block deployment; PostgreSQL still enforces it for new or updated rows.
Apply `20260929000100_admin_owned_profile_onboarding.sql` before using the new
candidate-creation option. It permits a candidate to exist without an uploaded
source resume; the first client upload fills the private file reference.

The form and its server action both sit behind authoritative admin checks. The
server-only service creates and confirms the Supabase Auth email, creates or
updates the candidate's core profile and package, then writes the `client`
role and candidate link. Failed steps attempt to restore the profile and remove
the new Auth user. The temporary password is shown only in the successful
response and is never logged or stored by the application. A copyable welcome
message includes it, but manual email/WhatsApp draft links omit it; deliver
the password separately through a secure channel. Set `NEXT_PUBLIC_APP_URL`
to the public application origin before provisioning. An `active` client can
enter `/client`; a `disabled` account is rejected by server-side portal
authorization.

For V1, transmit the temporary password through an approved secure channel. The
client can use the existing recovery flow to replace it. Production recovery
email delivery still requires suitable SMTP configuration.

## Session persistence and logout

`@supabase/ssr` owns the cookie-based session lifecycle. The application does not
create a second custom session store. The Next.js proxy verifies claims and
forwards refreshed cookies and cache headers to both browser and server clients.
Logout uses local scope, clearing the current browser session while leaving any
independent sessions on other devices unchanged.

## Client account administration QA

Use `/admin/clients` to open a linked client at
`/admin/clients/[userId]/edit`. Verify the following with fictional test data:

1. Change the email to an unused address and confirm both the Auth user and
   linked candidate profile use the new address.
2. Attempt an email already assigned to another Auth user or candidate and
   confirm the edit is rejected without changing the original account.
3. Change the assigned package and confirm both `selected_package_code` and
   `target_markets` match the selected active package definition.
4. Submit an altered/invalid package code and confirm it is rejected server-side.
5. Change `active` to `disabled`, accept the explicit non-deletion confirmation,
   and confirm the client can no longer enter `/client`.
6. Change `disabled` back to `active` and confirm client access is restored.
7. Confirm a client or unauthenticated session cannot load the admin routes or
   invoke the edit action successfully.
8. Confirm `user_roles.candidate_profile_id` remains unchanged after every edit.
