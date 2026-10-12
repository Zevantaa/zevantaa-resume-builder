# Independent-style security regression checklist

This is an internal negative-test plan, **not** an independent penetration test. Use only fictional accounts/files in an authorized preview environment. Record tester, build SHA, UTC time, request/response outcome and ticket; do not store passwords, tokens or CV content in evidence. Automated unit checks cover selected boundaries, but live/browser tests remain required.

| Area | Negative test / expected result |
| --- | --- |
| Broken access control | Signed-out `/admin`, `/client` and nested routes redirect or deny; no data in response. |
| Role escalation | Client requests admin actions/direct URLs; admin does not inherit client profile access. |
| IDOR/BOLA | Substitute another candidate/user/document/file ID in URL/form/action; server resolves own linkage or denies. |
| Provisioning | Duplicate email/profile, invalid package, disabled account and forged role input fail closed. |
| File access | Try public bucket URL, guessed object path, another client's file and archived/replaced file; no unrestricted bytes. |
| Upload abuse | Wrong MIME/extension/signature, oversized, empty, double extension, traversal name, malformed DOCX/PDF, decompression bomb; reject without public object. |
| Malformed payload | Oversized career arrays, invalid dates/URLs, unexpected fields and null/array confusion; structured safe errors, no mutation. |
| Recovery | Invalid/expired/reused link, missing callback parameters, wrong portal intent; no reset without verified recovery session. |
| Redirects | External `next`/callback target and hostile `Host` headers cannot create open redirect or role grant. |
| XSS | HTML/script in profile text, filenames and search are escaped in browser and not executed. |
| Security headers | HTTPS HSTS, CSP in actual browser, no framing, nosniff and private download `no-store` verified. |
| Rate limit | Remove key or break counter RPC in production-like environment; protected high-cost paths fail closed. |
| Audit access | Anon/client direct table read/write denied; service writes allowlisted event only, no content/secrets. |

Re-run after auth/storage/PDF changes. Capture both successful denial and non-sensitive audit/provider evidence. Escalate any unexpected access as an incident. Outstanding SEC-01 browser, Storage and recovery checks remain open even if this checklist exists.
