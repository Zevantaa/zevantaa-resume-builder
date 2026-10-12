# SEC-01 residual risk register

| Severity | Residual risk / evidence gap | Owner and required action |
| --- | --- | --- |
| High | Prepared least-privilege/rate-limit/audit migration is not applied; production rate-limited mutations fail closed until rollout. | DB owner: review migration, apply separately, verify ACLs/RLS/RPC grants/index and rollback plan. |
| High | Supabase leaked-password protection is disabled. | Auth owner: enable in Auth dashboard if plan supports it; verify weak/known password behavior. |
| High | No demonstrated database-plus-storage backup restore; free-tier capabilities unverified. | Operations: confirm plan, encrypted exports, restoration drill and realistic RPO/RTO. |
| Medium/High | No antivirus/sandbox for untrusted DOC/DOCX/PDF; parser/resource and polyglot risk remains. | Product/security: decide scanning or isolation strategy; cap extraction resources and monitor failures. |
| Medium | Recovery email flow previously failed live; callback unit tests pass but newest-link/PKCE/cookie behavior has not been reverified live. | Auth owner: test admin/client, reused/expired links and browser sessions. |
| Medium | CSP needs `'unsafe-inline'` for current Next hydration; nonce/strict CSP and browser compatibility are unverified. | Frontend/security: live browser review, then nonce migration. |
| Medium | Browser-direct Supabase login/recovery cannot use the app's server-side counters; provider rate limits/dashboard and network controls unverified. | Auth/operations: verify Auth rate limits and abuse alerts, assess proxy/WAF. |
| Medium | Fixed-window rate-limit counters require bounded retention/cleanup; no scheduler is configured. | Operations: schedule reviewed deletion of expired counters and monitor table growth after migration rollout. |
| Medium | Audit writes are best effort and only partly instrumented (account changes, career/upload, password update, PDF, brand); audit table is not immutable against privileged owners. | Security: expand events (review confirmation, explicit privacy generation, failures), monitoring/retention and tamper evidence. |
| Medium | Protected temporary extraction/PDF QA routes remain deployed if the branch is released unchanged. | Product/security: remove or feature-gate before production release. |
| Medium | Server-role bypass requires flawless application ownership checks; this is reviewed/tested, not independently pentested. | Security: manual BOLA/IDOR assessment and privileged-service review. |
| Low/Medium | No approved deletion/export/retention policy; no automated destructive retention implemented. | Product/legal: approve policy and test controlled workflows. |

No claim is made that absence of a reported issue proves absence of a vulnerability.
