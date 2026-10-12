# Control evidence index

This maps common enterprise diligence topics to engineering evidence; it is not an ISO/SOC control mapping or certification. “Prepared” does not mean remotely deployed.

| Topic | Evidence | Status / gap |
| --- | --- | --- |
| Access control | `src/features/authentication/authorization.ts`, role tests, `PRIVILEGED_ACCESS_STANDARD.md` | Server role checks; live MFA/privilege review pending |
| Secure SDLC | `.github/workflows/quality-security.yml`, tests, `CI_CD_SECURITY_GATES.md` | Local/CI gates added; branch protection not set |
| Change management | `ENVIRONMENT_AND_RELEASE_MANAGEMENT.md`, release/rollback checklists | Procedure; deployment approvals/evidence pending |
| Vulnerability management | full/production audit JSON, SBOM, `VULNERABILITY_MANAGEMENT.md`, `docs/security/DEPENDENCY_AND_SUPPLY_CHAIN.md` | Production audit zero after tested override; five High dev-only derived entries remain visible in full audit |
| Incident response | `INCIDENT_RESPONSE_PLAN.md`, disclosure process | Procedure; exercise/owner evidence pending |
| Backup/DR | `DISASTER_RECOVERY_PLAN.md`, drill template | No complete timed DB+Storage restore evidence |
| Data protection | private Storage code, governance/export/deletion runbooks | Live policy/erasure checks pending |
| Logging/audit | `src/lib/security/audit-events.ts`, SEC-01 migration, `AUDIT_AND_LOGGING_STANDARD.md` | Prepared/best effort; migration, monitoring and retention pending |
| Secure configuration | `scripts/validate-environment.mjs`, `.env.example`, Next.js headers | Production secrets/HTTPS/CSP/browser QA pending |
| Supplier/dependency risk | package lock, both audit gates, CycloneDX SBOM, Mammoth override tests | Production gate blocks; full dev-chain risk still requires review and upstream monitoring |

Record each live evidence link, date, owner and expiry in a restricted release dossier. Do not put credentials, candidate data or private URLs in this index.
