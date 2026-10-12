# SEC-01 threat model

Review date: 2026-10-11. Likelihood/impact are qualitative engineering estimates, not a penetration-test finding. Assets and boundaries are in [DATA_FLOW_AND_TRUST_BOUNDARIES.md](DATA_FLOW_AND_TRUST_BOUNDARIES.md). Residual risk assumes prepared controls are deployed; until then see the go/no-go decision.

| Threat | Asset / entry point | L/I | Existing mitigation | Required mitigation and residual risk |
| --- | --- | --- | --- | --- |
| Account takeover/brute force/enumeration | Auth login/recovery | M/H | Supabase Auth, generic login errors, no signup | Enable leaked-password protection; verify provider limits and alerting. Residual M. |
| Session theft/replay | SSR cookies, recovery link | M/H | SSR cookies, proof cookie, Supabase single-use token | Verify HTTPS/proxy cookie flags, live reused-link QA; browser compromise remains M. |
| Recovery callback/open redirect | Email callback, proxy headers | M/H | Recovery-only exchange | Configured-origin redirect added; live email/PKCE retest required. Residual L/M. |
| IDOR/BOLA/cross-client write | Profile ID, document ID, service-role reads | M/H | Server role and linked-profile lookup; action field allowlists | Expand hostile tests and service-level review. Residual M due service-role bypass. |
| Privilege escalation/admin misuse | Role mapping/admin actions | M/H | Server-backed `user_roles`, active status | Least-privilege grants, audit events, dual review for sensitive changes. Residual M. |
| SQL injection/dynamic SQL | RPC/migrations/query filters | L/H | Supabase query builder, typed input, event trigger uses `format('%s', object_identity)` | Revoke event function EXECUTE; review new SQL. Residual L. |
| XSS/HTML injection | Candidate text, URLs, rendered UI/PDF | M/H | React escaping, limited URLs, no general `dangerouslySetInnerHTML` | Safe URL validator and CSP; nonce CSP follow-up. Residual M. |
| CSRF | Cookie-backed Server Actions/POST routes | M/H | Next/Supabase SameSite, route Origin checks | Test cross-origin POST and verify proxy configuration. Residual M. |
| SSRF | Candidate URLs, PDF links, image optimization | L/H | No candidate-supplied server fetch | Block local/private URLs; pin Next security patch. Residual L/M. |
| Unsafe file/MIME spoof/path traversal | CV/photo/brand uploads | H/H | Size/MIME/extension/signature, generated keys, private buckets | Decode/dimension-limit photos, parser isolation and malware strategy; residual M/H. |
| Malicious DOCX/PDF/decompression bomb | Extraction and rendering | M/H | Size/structure limits, no macros/OCR | Process resource caps, patch parsers, sandbox/AV assessment; residual M/H. |
| Direct document/signed-URL disclosure | Download routes/storage | M/H | Private buckets, authorized server download, no public candidate URL | Verify headers, log access and deny arbitrary IDs. Residual M. |
| Sensitive log/error leakage | Server errors/browser errors | M/H | Generic public errors, no password logging intent | Audit logs and log-retention review; residual M. |
| Stale writes/race/partial failure | Career save, upload replacement, provisioning | M/M | Career revision checks, conditional file pointer update, rollback compensation | Concurrency/rollback tests and reconciliation runbook; residual M. |
| DoS/resource exhaustion | Auth, uploads, PDF render, parser | M/H | File size limits, form caps | Distributed counter migration and endpoint integration; provider limits. Residual M/H until live. |
| Dependency/supply-chain compromise | npm build/runtime | M/H | Lockfile | CI audit/SBOM/license review, patch cadence, pinned builds. Residual M. |
| Secrets leakage | Server env, bundle, repo | M/H | `server-only`, `.gitignore`, no browser service key | Secret scanning and rotation procedure. Residual M. |
| Backup loss/ransomware/operator error | Postgres/storage/config | M/H | Git history; provider capabilities unverified | Verified backup/export/restore drill and RPO/RTO. Residual H until demonstrated. |

No audit event table is immutable against a privileged database owner. No malware scanning, independent penetration test, legal compliance certification, or backup recovery guarantee is claimed.
