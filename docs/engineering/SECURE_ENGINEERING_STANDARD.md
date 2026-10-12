# Sofiology secure engineering standard (working V1)

This is a reusable development standard, not an ISO/SOC attestation.

1. Define assets, actors, data classification and trust boundaries before a feature. Record admin/client/service-role permissions and abuse cases.
2. Keep secrets in server-only modules and deployment secret manager; public keys are identifiers, not authorization. Reject missing production secrets.
3. Recheck active role and ownership server-side on every read/mutation; never rely on navigation visibility, client role flags or browser-supplied profile/storage IDs.
4. Use allowlisted, length-bounded server validation; treat URLs and file contents as untrusted. Do not parse or fetch arbitrary URLs without SSRF controls.
5. Keep buckets private. Use generated object keys, content validation, small size limits, safe download disposition and no-store/nosniff responses.
6. Use parameterized queries/RPCs, RLS, explicit grants and least privilege. Document every SECURITY DEFINER function, fixed search path and audit consequences.
7. Design writes for retries and concurrency: revision/CAS checks, idempotency or safe compensation, and explicit reconciliation for partial failure.
8. Log allowlisted event type, actor, target, timestamp, outcome and non-sensitive metadata. Never log credentials, tokens, CV text or document bytes.
9. Add negative tests for cross-role/ownership, unexpected fields, malformed input, stale writes, invalid files and redirects. Run full regression, lint, build and audit before release.
10. Review dependency/lockfile changes, license and install scripts. Prepare schema migrations but require separate review/application in production.
11. For every release, record evidence, residual risks, owner, dashboard/manual settings, backup/restore result and a qualified go/no-go verdict.
