# SEC-01 data flow and trust boundaries

Status: reviewed 2026-10-11; this is an engineering inventory, not a certification.

| Flow | Trust boundary | Enforcement and data |
| --- | --- | --- |
| Browser → Next.js page/action | Untrusted forms, URL parameters and files enter the server | Admin/client layouts and mutations recheck `requireApplicationRole`; actions allowlist fields. Browser-supplied IDs are never authority for a client's linked profile. |
| Browser → Supabase Auth | Public publishable key; password handled by Supabase Auth | Browser login/recovery uses Supabase Auth directly. Provider rate limits and leaked-password protection require dashboard verification. Portal query parameter is intent, not role. |
| Next.js → Supabase Auth | SSR cookies and bearer identity | `getClaims()` identifies the user; `user_roles` supplies role/status; disabled accounts are denied. Recovery proof is short-lived and signed, with an HttpOnly, SameSite=Lax cookie. |
| Next.js → public tables | Service-role secret, server only | Protected reads/writes use `createSupabaseAdminClient`; authorization and ownership must precede service-role calls. Only authenticated own-row `user_roles` SELECT is granted. |
| Next.js → Storage | Service-role secret, private buckets | `candidate-intake-private` holds source CVs and GCC photos; `zevantaa-brand-assets` holds approved brand assets. Server generates object keys; no browser public file URL. |
| Next.js → PDF response | Authenticated output, transient bytes | Server reloads canonical data and returns PDF with private/no-store headers. Employer-masked output derives a separate view without modifying canonical data. |
| Email → browser → callback | External untrusted link and URL | Supabase verifies recovery token; callback accepts only recovery exchange and redirects to configured application origin. No code/token/password logging. |

Candidate PII includes contact, location, career facts, photos, source and generated documents. Admin owns identity/contact/package; client may edit career facts and upload authorized source files. Brand settings and skill library are service-role mediated. Future providers and actual deployment proxies must be reviewed against this diagram before use.
