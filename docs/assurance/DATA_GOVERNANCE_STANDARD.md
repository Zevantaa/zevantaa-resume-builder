# Data governance standard

Data owner: Zevantaa/Sofiology-appointed business owner; technical custodian: application operator. Formal controller/processor roles and legal basis require contract/privacy review, not an engineering assertion. Collect candidate identity, contact, career history, source files and generated documents only for intake, review, package delivery and support. Admin controls core profile/package; clients may update permitted career sections and private uploads. Do not use CV content in logs, analytics, test fixtures or unapproved AI services.

| Category | Purpose | Access/retention decision |
| --- | --- | --- |
| Auth/role records | Login and authorization | Named admin/client; disable does not delete. Retention set by owner/contract. |
| Profile/career/outputs | Resume service | Private, role-scoped. Archive/delete only via approved request and dependency review. |
| Source/photo/derived files | Intake and deliverables | Private Storage plus file records; DB backup alone does not include objects. |
| Security audit | Accountability/incident response | Restricted; recommend 12 months, subject to approved policy. |
| Backups | Recovery | Separate retention and deletion schedule; backup expiration affects erasure timing. |

Maintain a data inventory with owner, location, purpose, access roles, retention period, recipient and deletion verification. Current code does not enforce a legal retention schedule. Do not add unattended purge without owner/legal approval. Follow [deletion](DATA_RETENTION_AND_DELETION_RUNBOOK.md) and [export](DATA_EXPORT_RUNBOOK.md); record requests and approvals without adding PII to tickets.
