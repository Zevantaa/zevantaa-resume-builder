# Administrator access handover — responsibilities only

Frozen V1 has one master administrator role and admin-provisioned client accounts; there is no public self-registration or staff permission tier. This page contains no passwords, token material, recovery links or account identifiers. Actual admin access, provider settings and MFA still require controlled handover evidence.

| Responsibility | Boundary |
| --- | --- |
| Master administrator | Use the protected `/admin` area for client directory, provisioning/editing, package assignment, review and document operations. Server authorization uses the active database-backed `admin` role, not the login URL. |
| Client account creation | Admin creates a Supabase Auth user, `client` role and one-to-one candidate-profile link through the trusted provisioning flow. A one-time temporary password is shown only on immediate success; deliver it separately through an approved secure channel. No plaintext password is persisted. |
| Account administration | Admin may edit login/profile contact fields, active/disabled status and the assigned active V1 package. Disable access without deleting Auth identity, profile or document history; reactivation requires an authorized edit. Invalid/unknown packages grant no entitlement. |
| Client boundary | Clients see administratively managed identity, contact, location, relocation and package values read-only. They can replace their own source resume and optional GCC photo, and edit their own canonical career sections in `/client/career-profile`. They cannot set package, role or another candidate's profile ID. |
| Document and brand control | Admin reviews extraction proposals, accesses permitted document versions and creates a separate privacy-masked employer copy that removes personal contact routes; the original remains unchanged. Brand settings are an admin-only operation. |

Supabase Auth handles password recovery through an exact allowlisted callback, verified recovery session and short-lived proof before password update. A successful reset signs out the recovery session and requires a fresh login. [Auth configuration](AUTH_CONFIGURATION.md) describes the flow; production email delivery and newest/expired/reused-link QA remain OPEN. Portal intent is never proof of role.

Admin MFA enrollment/challenge and enforced `aal2` are **not implemented or active**. This is an OPEN release gate, not a claim that the current master admin is MFA-protected. Provider-side leaked-password protection, SMTP and effective branch/access controls also require live verification. See [manual release gates](REL_01_MANUAL_RELEASE_GATES.md), [access-control matrix](security/ACCESS_CONTROL_MATRIX.md), and [security architecture](security/SECURITY_ARCHITECTURE.md). Authorized owners must provision and verify actual repository, provider and Auth access out of band; do not record credentials in the handover pack.
