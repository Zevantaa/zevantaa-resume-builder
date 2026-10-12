# Release checklist (copy per release)

Record release ID, UTC time, commit SHA, owner, reviewer, environment and change ticket before starting. A checked box needs a link to evidence, not a verbal assertion.

- [ ] Scope/V1 review; release notes and rollback owner identified.
- [ ] PR review and required `quality-security` CI check passed; `npm audit` findings triaged, SBOM retained.
- [ ] `npm run environment:validate -- production` passed using the target environment; separate preview/prod project and secrets confirmed without displaying values.
- [ ] Secret scan, tests, lint, build and `git diff --check` passed at the release SHA.
- [ ] Migration list, dependency order, RLS/grants, private Storage policies and backup snapshot reviewed. Apply only with explicit approval; verify after applying.
- [ ] Fresh Auth recovery, redirect allowlist, leaked-password protection, role isolation, private downloads, browser CSP and upload checks passed live.
- [ ] Database and Storage restore drill evidence current; incident owner and rollback path reachable.
- [ ] SEC-01 six deferred gates and all entries in `docs/security/SEC_01_GO_NO_GO.md` resolved with evidence. If not, production is **NO-GO**.
- [ ] Deploy reviewed SHA; smoke test admin/client login, role denial, intake, private output and audit writing; monitor errors and resource use.
- [ ] Record actual deployment time, results, deviations, approval and follow-up owner in release log.

No item here authorizes remote settings changes or certifies compliance.
