# Secure development lifecycle

The project uses reviewed source control, a frozen V1 scope, TypeScript models, migration files, role/ownership regression tests, file validation tests and `npm` dependency inventory. The `quality-security` workflow runs clean install, tests, lint, production build, production-dependency audit, tracked-text secret-pattern scan, whitespace check and SBOM generation on PRs/pushes. Branch protection is recommended but not configured by this task. Findings require human triage and documented release decisions; passing CI does not prove runtime security.

Security-sensitive releases require live Auth, role isolation, private download, CSP, Storage-policy and restore QA. The prepared SEC-01 migration and remote settings are not represented as deployed. No independent penetration test or formal ISO/SOC audit has been completed or claimed. See assurance runbooks for change, incident and vulnerability processes.
