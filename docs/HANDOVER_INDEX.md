# Technical handover index — preparation only

This pack helps a future technical owner navigate the code and open release obligations. It is **not** delivery, production acceptance, a final demonstration or defect closure. The REL-01 [manual/provider register](REL_01_MANUAL_RELEASE_GATES.md) remains OPEN and the release decision remains NO-GO.

Some feature and assurance documents capture the state at the time they were written. Where an older page describes a migration or document-delivery path as only prepared, use the later [REL-01 production preparation](REL_01_PRODUCTION_PREPARATION.md) and [DOC-13 delivery record](DOC_13_PERSISTENT_DOCUMENT_DELIVERY.md) for current code-side context, then obtain fresh live evidence before changing a gate.

| Topic | Reference |
| --- | --- |
| Source repository and architecture | [Source-code handover](HANDOVER_SOURCE_CODE.md), [structured candidate profile](STRUCTURED_CANDIDATE_PROFILE.md), [DOC-13 delivery](DOC_13_PERSISTENT_DOCUMENT_DELIVERY.md) |
| Environment and deployment | [Deployment handover](HANDOVER_DEPLOYMENT_CONFIGURATION.md), [environment matrix](PRODUCTION_ENVIRONMENT_MATRIX.md), [production preparation](REL_01_PRODUCTION_PREPARATION.md) |
| Administration | [Administrator-access handover](HANDOVER_ADMIN_ACCESS.md), [Auth configuration](AUTH_CONFIGURATION.md) |
| Operations | [Operating notes](HANDOVER_OPERATIONS.md), [read-only diagnostics](REL_01_OPERATIONAL_DIAGNOSTICS.md), [known limitations](HANDOVER_KNOWN_LIMITATIONS.md) |
| Security architecture | [Security architecture](security/SECURITY_ARCHITECTURE.md), [trust boundaries](security/DATA_FLOW_AND_TRUST_BOUNDARIES.md), [dependency policy](security/DEPENDENCY_AND_SUPPLY_CHAIN.md) |
| Backup, restore and release | [Disaster recovery](assurance/DISASTER_RECOVERY_PLAN.md), [restore drill template](assurance/RESTORE_DRILL_TEMPLATE.md), [rollback](assurance/ROLLBACK_PROCEDURE.md), [release checklist](assurance/RELEASE_CHECKLIST.md), [manual gates](REL_01_MANUAL_RELEASE_GATES.md) |

## Technical-owner checklist

`PREPARED` means code/documentation exists, **not** that a person has accepted access. `OPEN` needs named-owner, UTC-date and restricted evidence before handover or release sign-off. Do not record credentials or private candidate data here.

| Item | Status | Evidence still needed |
| --- | --- | --- |
| Repository access | OPEN | New owner confirms least-privilege clone/review access. |
| Environment configuration | OPEN | Approved target variables confirmed by masked presence and validator, not values in Git. |
| Supabase project access | OPEN | Approved project, authorized role and Auth/DB/Storage access verified. |
| Vercel access | OPEN | Approved project, domain, environment and rollback permissions verified. |
| GitHub access and rules | OPEN | Appropriate repository role and effective branch/ruleset checks evidenced. |
| Auth/admin access | OPEN | Master admin access and safe recovery/MFA plan verified out of band. |
| Backup/recovery knowledge | OPEN | Owner reviews vault and completes a timed isolated DB-plus-Storage restore drill. |
| Release procedure | PREPARED; live approval OPEN | New owner reviews gates, exact SHA/CI and rollback, then rehearses approved procedure. |
| Monitoring/diagnostics | PREPARED; live access OPEN | Operator confirms dashboards, restricted diagnostics, alerting and escalation path. |
| Documentation reviewed | OPEN | Named technical owner records review and outstanding questions. |

REL-03-06 final demonstration, REL-03-07 defect closure and REL-03-08 delivery sign-off remain untouched. REL-02 is not started by these documents.
