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

Client users are not created by this batch. They will be provisioned through the
future administrator workflow; dashboard-created fictional users may be used for
manual login testing in the meantime.

## Deliberate access-control boundary

The current portal selector records login intent and sends a successfully
authenticated user to `/admin` or `/client`. It does not grant or verify a role.
Authoritative administrator/client role mapping, route protection, and
role-specific access checks are deferred to FND-04-04 and later access-control
work. Do not rely on the portal query parameter as authorization.
