# Encrypted backup release readiness

Date: 2026-11-12  
Scope: Windows Home production-release backup and isolated recovery controls  
Status: **Code-complete; production execution remains prohibited during this change**

## Implemented controls

- The release orchestrator requires official signed `age` 1.3.2 and two distinct
  post-quantum recipients. One local identity is protected at rest with Windows
  DPAPI CurrentUser and a restricted ACL outside both Git and the evidence
  directory. The second recipient belongs to an offline Zevantaa recovery key;
  its private identity is never supplied to the release process.
- Supabase CLI 3.1.0 remains the authority for roles, application schema,
  recovery-only Auth/Storage managed schema, data, and migration
  history dump plans. Because its Windows `--file` option cannot stream, the
  orchestrator captures the authenticated `--dry-run` plan only in memory,
  validates its Zevantaa production target, and runs that exact Bash pipeline in
  an ephemeral pinned Supabase Postgres container. SQL stdout flows directly into
  age. No `.sql` file or plaintext dump is created.
- The Storage helper downloads each object into bounded process memory, hashes
  the actual bytes, streams them directly to age, clears the buffer, and writes
  only `.age` ciphertext. Object keys, hashes, sizes, content types, and bucket
  inventory are themselves stored only in an encrypted manifest.
- Recovery uses a network-disabled container with PostgreSQL data and object
  staging mounted on Docker `tmpfs`. Database artifacts are authenticated and
  streamed into one `psql --single-transaction` restore. Every Storage object is
  authenticated, written to memory-only `/restore`, read back twice, size-checked,
  SHA-256 checked, and removed. Aggregate database counts include Auth users,
  roles, profiles, files, documents, jobs, ATS snapshots, and private Storage
  metadata. The manifest object count must match restored Storage metadata.
- Ciphertext checksums cover every encrypted artifact. A backup is rejected if
  any non-`.age` payload appears, if age authentication fails, if database counts
  differ, if an object byte differs, or if the memory-only restore cannot be
  demonstrated.

## Preserved safeguards

- Exact repository, branch, commit, Supabase project, Vercel project, private
  bucket allowlist, migration order, invitation-migration preservation checks,
  Auth/SMTP attestation, worker-secret verification, explicit mutation approvals,
  and inactive-Cron requirements are unchanged.
- No production database reset, migration, deployment, credential change, Cron
  activation, account update, document update, or Storage deletion is performed
  by this implementation work.
- BitLocker is no longer a functional prerequisite only when the age tool,
  DPAPI-protected local identity, distinct offline recipient, encrypted stream,
  ciphertext checksums, and Docker tmpfs recovery gates all pass. Otherwise the
  orchestrator stops before reading production payloads.

## Validation required for release execution

1. Verify official age 1.3.2 archive signature/checksum and tool version.
2. Initialize the DPAPI-protected local identity once and independently secure
   the offline private recovery identity.
3. Run `Prepare` against a new evidence directory and retain its ciphertext
   checksums and `RESTORE-PASSED.txt` result.
4. Confirm the evidence directory contains no plaintext SQL, JSON manifest, or
   private object files.
5. Continue to migration-history repair only after all existing release gates
   and the explicit operator approval requirement pass.

## Validation completed for this change

- Official `age` v1.3.2 Windows AMD64 archive matched published SHA-256
  `f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7`.
- Synthetic payload encryption to two distinct post-quantum recipients succeeded;
  the independently generated offline identity decrypted the ciphertext.
- The actual orchestrator key functions created a DPAPI-protected identity with
  a protected ACL. The at-rest bytes contained no age private-key marker, and
  DPAPI recovery returned the original identity in memory.
- A read-only ephemeral dump container streamed synthetic plan output directly
  into age and was decrypted through the offline identity.
- A fresh network-disabled Supabase Postgres container restored encrypted
  database artifacts into a 4 GiB `tmpfs` and one encrypted private object into a
  2 GiB `tmpfs`. Database aggregates matched, the 31-byte object matched its size
  and SHA-256 on read-back, zero plaintext persistent writes were reported, and
  the object staging area was empty afterward.
- Repository validation: 423/423 tests, ESLint, TypeScript, production build,
  secret scan, and whitespace checks passed; the production dependency audit
  reported zero vulnerabilities.

No production payload was read during these implementation tests. The first live
`Prepare` run must still prove encrypted coverage and recovery for the actual
database and all three private buckets before any migration repair is allowed.

Official references:

- Supabase CLI backup and restore: <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- age project and documentation: <https://github.com/FiloSottile/age>
