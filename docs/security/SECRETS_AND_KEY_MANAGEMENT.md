# SEC-01 secrets and key management

| Class | Placement | Handling |
| --- | --- | --- |
| Supabase URL/publishable key | `NEXT_PUBLIC_*`; browser-safe identifiers | Allowed in client bundle; not an authorization secret. |
| `SUPABASE_SECRET_KEY` / service-role key | Server environment only | Bypasses RLS; never prefix `NEXT_PUBLIC_`, log, embed in URLs, or import into client components. |
| `SECURITY_RATE_LIMIT_KEY` | Server environment only | New independent 32+ character HMAC key for pseudonymous counter subjects; rotate with a managed overlap/window reset. |
| User passwords/invitation and recovery tokens/session cookies | Supabase Auth / browser cookie mechanisms | No plaintext persistence or logging. Client provisioning stores delivery state only; password setup uses a verified, short-lived proof. |

Use deployment secret manager and per-environment credentials. `.env.example` contains placeholders; `.env.local` must remain ignored. Production should fail closed when server secrets or configured application origin are missing. Check Vercel/hosting environment scope (production/preview/development) and restrict who can read or edit secrets.

Rotation: create replacement provider key, deploy server configuration atomically, verify admin/client sessions and storage access, then revoke old key. Rotating a service-role key also invalidates recovery-proof signatures if used as signing key; existing recovery links must be reissued. Rotate `SECURITY_RATE_LIMIT_KEY` separately; old hash counters expire at window boundaries. In exposure response: revoke/rotate immediately, invalidate sessions if necessary, inspect audit/provider logs, assess accessible PII, preserve evidence, notify owners and follow incident policy. Never paste secrets into tickets.

Transport relies on HTTPS/TLS at deployment and Supabase-managed encryption at rest. Application-level field encryption is not implemented; adding it would require key hierarchy, rotation, recovery and search-index design. No such schema change is justified without an approved threat/operations decision.
