# ASSUR-01 go/no-go decision

Decision date: 2026-10-12. **NO-GO for production release.** ASSUR-01 implementation is an assurance foundation, not closure of SEC-01. This verdict can change only after dated evidence, named owner/reviewer and a release decision—not by editing this page alone.

The six explicitly deferred SEC-01 live gates remain **OPEN**:

1. Independent production `SECURITY_RATE_LIMIT_KEY` and applied/verified counter migration.
2. Canonical HTTPS `NEXT_PUBLIC_APP_URL` and redirect allowlist.
3. Supabase leaked-password protection.
4. Fresh-email recovery live QA for admin/client, including invalid/reused links.
5. Browser CSP and private-download/Storage-role QA.
6. Timed database **and** Storage restore drill.

Also verify the prepared SEC-01 migration, audit sink/monitoring, privileged MFA, branch protection and malicious-file parsing residual risk. The tested `argparse@2.0.1` override removes Mammoth's three transitive Moderate entries; `npm audit --omit=dev` now reports **zero**. Full `npm audit` still exits nonzero with **five High development-only entries** from unpatched `braces`. CI hard-fails on production findings and retains visible full-audit evidence for review; neither finding is hidden or called fixed. The dependency improvement does **not** close any SEC-01 live gate or change the NO-GO verdict. No remote Supabase/GitHub settings were changed. The release owner should attach evidence to `RELEASE_CHECKLIST.md`, update the risk register and seek business approval before reconsidering production. This is not a compliance or penetration-test opinion.
