# SEC-01 security test evidence

Review date: 2026-10-11. Reproduce with `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd audit`, `npm.cmd audit --omit=dev`, `npm.cmd run security:sbom`, and `git diff --check`. Final local run: **301/301 tests**, build passed, both npm audits found zero current vulnerabilities, CycloneDX SBOM generated to stdout, and `git diff --check` exited 0 (with Windows line-ending notices). The release owner should archive command output and commit hash separately. Lint status is recorded in the task handoff.

Automated evidence includes:

- `tests/password-recovery.test.mjs`: recovery-only PKCE/token-hash paths, flow ID, signed user-bound proof, expired/invalid callbacks and hostile forwarded-host redirect.
- `tests/sec-01-security.test.mjs`: malformed/active/internal URLs, prepared SQL privilege revocation/index/RLS, server role and field-allowlist safeguards.
- `tests/sec-01-rate-audit.test.mjs`: fail-closed production counter behavior, pseudonymous HMAC subject, bounded RPC, no candidate content in event payload.
- `tests/fnd-06-08-10.test.mjs`: upload size/type/MIME/structure, filename traversal, pixel dimensions, private replacement, cross-profile isolation and locked-field tampering.
- `tests/dsh-06-career-action.test.mjs`, `tests/dsh-06-career-service.test.mjs`: unauthorized save, unexpected fields, stale revision, forged existing-row IDs.
- `tests/dsh-02-client-dashboard.test.mjs`, `tests/dsh-04-privacy-masked-export.test.mjs`, `tests/dsh-05-system-controls.test.mjs`: cross-client document access, privacy generation/admin guard, package and brand boundaries.
- `tests/fnd-05-07.test.mjs`: provisioning, duplicate linkage and email, disabled account and cross-role authorization.

Read-only Supabase inspection found 16 public tables with RLS enabled; only `user_roles` has an authenticated own-row SELECT policy. Other public tables are intentional server/service-role-only. Two private buckets were observed (`candidate-intake-private`, `zevantaa-brand-assets`). Security advisor reported disabled leaked-password protection; Performance Advisor reported the review FK index gap. The SEC-01 migration is prepared, **not applied or live-tested**.

Not evidenced by automation: a fresh real password-recovery email end-to-end, browser CSP compatibility, Supabase dashboard setting, remote migration rollout/ACL verification, live rate-limit behavior, malware detection, independent penetration test, restore drill, or production monitoring. These are release gates, not passes inferred from mocks.
