# SEC-01 data classification and PII register

| Data | Classification | Main location |
| --- | --- | --- |
| Name, email, phone, WhatsApp, LinkedIn, location | Confidential personal | Auth/profile tables, admin screens, original CV |
| Employment, education, skills, certifications, salary if ever collected | Confidential personal | Profile child tables, source/generated CV; salary is not a V1 collected field |
| GCC photo | Sensitive personal image | Private candidate storage and file record |
| Source CV, generated/original CV, employer-masked CV | Confidential; source may contain additional sensitive facts | Private storage or transient PDF response; document metadata tables |
| Package assignment, career review state | Internal/confidential | Profile, review and package tables |
| Audit actor IDs, timestamps, status | Internal personal metadata | Auth and proposed `security_audit_events` |
| Brand assets, non-secret design configuration | Public-safe after approval | App route and private brand bucket |
| Passwords, service keys, recovery codes | Restricted secret | Supabase Auth/secret manager; never application tables/logs |

Minimize displayed contact data to necessary admin/client contexts. Employer PDF removes direct routes and uses a separate derived model; original remains intact. Do not place PII in object keys, query parameters, filenames generated for downloads, logs or audit metadata. Error messages should not reveal whether an email/account exists to anonymous users.

Retention is a **framework pending business/legal approval**, not an automated policy: define purpose, owner, retention period, legal hold, deletion approval and evidence for each table/storage class. Candidate deletion must first verify identity/authority, assess linked Auth user and history, export if required, archive or delete relational data and private objects in a controlled order, then verify no orphaned references. Disable access immediately where deletion is delayed. Data export requires authenticated authorization and collection of profile, files, documents and audit metadata with secure delivery. Do not run destructive automated retention until approved and tested.
