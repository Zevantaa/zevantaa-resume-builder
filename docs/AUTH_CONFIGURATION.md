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

Password recovery returns through the application callback before the user sets
a new password. Add these exact local URLs under
**Authentication > URL Configuration > Redirect URLs**:

The recovery request and callback both require `NEXT_PUBLIC_APP_URL` to be a
clean configured origin; neither uses the browser's current origin or forwarded
Host headers as a redirect authority. Production requires HTTPS. A missing or
malformed origin fails recovery closed instead of constructing a link from the
incoming request. Configure the matching origin before live recovery QA.

- `http://localhost:3000/auth/callback?portal=admin`
- `http://localhost:3000/auth/callback?portal=client`

Add the same two paths for the production HTTPS origin. Prefer exact production
URLs rather than broad wildcard entries.

For reliable recovery when the email link opens in a different browser or device,
set **Authentication > Email Templates > Reset Password** to use a token-hash
link instead of the default PKCE verification URL. Keep the surrounding email
copy appropriate to your organization and use this link target:

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

The application always supplies `RedirectTo` as `/auth/callback?portal=admin`
or `/auth/callback?portal=client`, so the appended parameters remain a valid
query string. Send a **new** recovery email after saving the template; existing
links cannot be converted. Do not paste a real token or password into the
template. The callback calls `verifyOtp` server-side using the one-time recovery
token hash, then establishes the Supabase cookie session. This removes the
original browser's PKCE-verifier dependency. Keep the exact redirect URLs above
allowlisted; portal intent never grants a role.

The callback also accepts the standard PKCE redirect for older emails:
`/auth/callback?portal=admin&code=...` (and optional `sb_flow_id`). PKCE requires
the verifier cookie created when recovery was requested, so that fallback works
only when the link opens in the same browser context. An existing `portal` query
parameter is preserved by Supabase Auth when it appends `code`; `sb_flow_id`
appears only if its experimental flow-ID option is enabled.

The callback grants a 15-minute, HTTP-only, signed recovery proof only after a
verified recovery exchange. The reset page and password-update Server Action
require both that proof and a server-verified Supabase user. The action consumes
the proof and signs out the recovery session after a successful update, so the
user signs in again with the new password. The signature uses the existing
server-only `SUPABASE_SECRET_KEY` (or legacy service-role fallback); this key
must be configured on the application server. Recovery codes, token hashes and
passwords are not logged or stored by the application.

The hosted default email service is suitable only for limited testing; configure
production SMTP before relying on recovery emails operationally.

Client users are created only through the protected administrator invitation
workflow described below.

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
server-only service creates or updates the candidate profile, records a private
`client_onboarding_invitations` delivery attempt, and calls Supabase Auth's
administrator invitation API. The returned Auth user is linked to the existing
`client` role only once. No password, invitation token, or email body is stored
by the application. Failed delivery remains visible and can be retried from
durable state. An unaccepted `sent` invitation can also receive a fresh setup
email from the admin workflow when its original link expires. The server
atomically claims the row before contacting Auth, so concurrent clicks cannot
duplicate delivery. An unconfirmed Auth user receives a new invite; an email-
confirmed user who did not finish password setup receives the existing recovery
flow. Neither path deletes, relinks, or exposes the Auth user.

Apply `20261111085249_client_onboarding_invitation_state.sql`, followed by
`20261113052443_complete_client_experience_admin_ats.sql`, before deploying this
code. Set `NEXT_PUBLIC_APP_URL` to the exact public HTTPS origin. Add this
exact production redirect URL under **Authentication > URL Configuration >
Redirect URLs**:

```text
https://YOUR-APP-ORIGIN/auth/callback?portal=client&intent=invite
```

For device-independent invitation activation, configure **Authentication >
Email Templates > Invite user** with a token-hash target (retain approved
Zevantaa wording around it):

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=invite">Set up your Zevantaa account</a>
```

Do not place a password, real token, or service key in the template. The link
establishes a short-lived verified setup session; after the client sets a
password, the application records `accepted_at`, consumes the proof, and signs
out the setup session. An `active` client can then enter `/client`; a `disabled`
account remains rejected by server-side authorization.

The UI states are deliberately precise: `pending` means a send call is in
progress, `sent` means Supabase Auth accepted the invitation or recovery setup
email for delivery (not proof of inbox placement), `failed` is safely retryable,
and `not-sent` is a durable pre-send state. A linked failed row is retried without
creating or deleting an Auth user. Production use requires custom transactional
SMTP. Supabase's default sender is appropriate only for limited testing and must
not be treated as reliable client delivery.

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
