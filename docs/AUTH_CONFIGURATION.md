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

Assign the current test client by replacing the example address with that
user's actual Auth email before running the statement:

```sql
insert into public.user_roles (user_id, role_code)
select id, 'client'
from auth.users
where lower(email) = lower('test-client@example.invalid')
on conflict (user_id) do update
set role_code = excluded.role_code,
    updated_at = now();
```

Verify both assignments without exposing credentials:

```sql
select u.email, r.role_code
from auth.users as u
join public.user_roles as r on r.user_id = u.id
where lower(u.email) in (
  lower('tech@sofiology.com'),
  lower('test-client@example.invalid')
)
order by u.email;
```

These statements must be run only from the trusted Supabase SQL Editor or a
future protected provisioning service. No service-role key is used by the
browser application.

## Session persistence and logout

`@supabase/ssr` owns the cookie-based session lifecycle. The application does not
create a second custom session store. The Next.js proxy verifies claims and
forwards refreshed cookies and cache headers to both browser and server clients.
Logout uses local scope, clearing the current browser session while leaving any
independent sessions on other devices unchanged.
