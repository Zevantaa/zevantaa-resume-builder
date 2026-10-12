# Rollback procedure

Owner: on-call release engineer with the incident owner. Trigger on failed access/security smoke test, data integrity failure, unavailable private downloads or unacceptable error/resource growth.

1. Stop promotion and record UTC start time, affected commit, environment, symptoms and operator. Preserve logs without copying secrets or CV content.
2. Disable the affected deployment/traffic through the hosting control plane, then redeploy the last known-good immutable commit and matching environment configuration. Never roll back a secret rotation by restoring a compromised key.
3. Treat database migrations separately. Inspect whether the new code is backward-compatible with the applied schema. Do not run destructive down-migrations blindly. Use an approved forward repair or verified backup restore with business-owner approval and a data-loss assessment.
4. If Storage or database state must be restored, follow `DISASTER_RECOVERY_PLAN.md`; coordinate both stores and Auth state. Never assume a database backup contains Storage objects.
5. Re-run login, role separation, private file access, download and audit smoke tests. Confirm restored version and document affected users, data window and remaining risk.
6. Open an incident/postmortem, notify decision owner and delay re-release until cause and verification are recorded.

Rollback capability and timing remain **unverified** until a timed drill is completed. This document is a procedure, not evidence of a successful restore.
