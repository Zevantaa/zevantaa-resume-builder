# Production release access checklist

Complete this checklist before running the Zevantaa production release command.
Never paste credential values into this file, terminal transcripts, tickets, or
the release report.

## Operator and workstation

- [ ] Named Zevantaa release operator and independent reviewer are recorded.
- [ ] Windows PowerShell 5.1 or PowerShell 7, Node 22, npm, Git, and Docker
  Desktop are installed. The isolated Supabase container supplies `psql`.
- [ ] The workstation has sufficient encrypted disk space for database dumps and
  all private Storage objects.
- [ ] `EvidenceRoot` is an absolute, access-restricted path outside this Git
  checkout and outside every synchronized/public folder.
- [ ] Provider accounts use MFA and belong to Zevantaa, not Sofiology.

## GitHub

- [ ] `origin` is exactly `https://github.com/Zevantaa/zevantaa-resume-builder.git`.
- [ ] The operator can read the repository and perform a dry-run push to
  `feature/premium-uiux-document-upgrade`.
- [ ] The exact immutable commit is reviewed and present on the remote feature
  branch. No force-push or automatic merge is authorized.

## Supabase

- [ ] The pinned Supabase CLI can list project `fzltowzpfrnuxxxrzuih`.
- [ ] The scoped access token grants only the necessary project/database read
  access for dry-run; separately approved release work may require database write.
- [ ] The scoped Supabase CLI identity grants `api_gateway_keys_read` and
  `api_gateway_keys_secret_read`. The official API-key command injects the
  default project secret into only the private Storage backup child process;
  the key is not echoed, written to disk, or included in reports.
- [ ] Docker can run the Supabase local stack; the restore uses only the `psql`
  binary inside its isolated database container.
- [ ] Backup capacity covers roles, schema, data, migration history, managed-schema
  customizations, and all bytes in the three approved private buckets.

## Vercel

- [ ] The repository is linked to the existing Zevantaa Vercel project; do not
  allow the CLI to create a project.
- [ ] The approved project ID is recorded outside Git and resolves production
  domain `https://ats.zevantaacareers.com`.
- [ ] The operator can inspect the project, list production variable names, deploy,
  inspect deployments, and read sanitized error logs.
- [ ] The project plan/runtime supports the reviewed 300-second worker declaration
  and 290-second scheduler timeout with measured margin.

## Secret-free Auth/SMTP attestation

Provide a JSON file outside Git with these exact target fields and booleans. It
must not contain host credentials, passwords, API keys, tokens, or SMTP secrets.

```json
{
  "projectRef": "fzltowzpfrnuxxxrzuih",
  "productionOrigin": "https://ats.zevantaacareers.com",
  "checkedBy": "named reviewer",
  "checkedAtUtc": "2026-11-11T00:00:00Z",
  "customSmtpConfigured": true,
  "siteUrlMatches": true,
  "exactRedirectsConfigured": true,
  "inviteTemplateVerified": true,
  "recoveryTemplateVerified": true,
  "signupDisabled": true,
  "anonymousSignInDisabled": true,
  "privateBucketsVerified": true,
  "anonymousStorageDenied": true,
  "crossClientRlsDenied": true,
  "workerSecretsIndependentlyVerified": true,
  "secretValuesExcluded": true
}
```

The exact redirect allowlist is:

- `https://ats.zevantaacareers.com/auth/callback?portal=client&intent=invite`
- `https://ats.zevantaacareers.com/auth/callback?portal=client`
- `https://ats.zevantaacareers.com/auth/callback?portal=admin`

## Signed production authorization

Provide a second secret-free JSON file outside Git. Set only approvals actually
granted for the reviewed commit.

```json
{
  "projectRef": "fzltowzpfrnuxxxrzuih",
  "productionOrigin": "https://ats.zevantaacareers.com",
  "commit": "full 40-character reviewed SHA",
  "checkedBy": "named release owner",
  "checkedAtUtc": "2026-11-11T00:00:00Z",
  "allowMigrationRepair": false,
  "allowSchemaMigration": false,
  "allowDeployment": false
}
```

Migration repair may be set true only after the orchestrator produces an empty
shadow-versus-live schema diff for the state ending at migration
`20261103223240`. Repair corrects migration history only; it never proves schema
equivalence by itself.
