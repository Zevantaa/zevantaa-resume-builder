# REL-01 manual/provider release gates — all OPEN

This register is deliberately separate from `npm run release:verify`. No item below was completed by the code-side REL-01 pass. Record a named owner, UTC date, approved project/domain, and restricted evidence link for each gate. Do not paste credentials, token hashes, private object keys or candidate documents into evidence.

| Manual/provider gate | Required final-stage evidence | Status |
| --- | --- | --- |
| Vercel production project and environment | Approved project; production-only public/server variable names and masked presence check; `environment:validate -- production` in target environment | OPEN |
| Approved HTTPS subdomain | DNS/TLS ownership and exact `NEXT_PUBLIC_APP_URL`; no preview origin substitution | OPEN |
| Supabase Auth URL settings | Site URL and exact admin/client `/auth/callback?portal=...` allowlist; token-hash reset template | OPEN |
| Leaked-password protection | Enable or formally reject release; provider setting and password/reset retest | OPEN — previously observed disabled |
| Admin MFA | Implement/test enrollment and challenge path, enroll master admin, then enable/verify `aal2` enforcement on all privileged access; no role-only switch is currently active | OPEN — code enforcement not yet present |
| SMTP and provider limits | Production SMTP delivery plus sign-in/recovery rate-limit and abuse-control evidence | OPEN |
| Unlinked client-role disposition | Trusted [diagnostic](REL_01_OPERATIONAL_DIAGNOSTICS.md), verified account identity, approved link/disable action, rerun denial and integrity checks | OPEN |
| GitHub branch rules / plan | Confirm whether current plan permits effective `develop`/`main` rules; upgrade to Team or choose an approved compensating control if enforcement requires it; record required Quality and security check context | OPEN |
| Authenticated live QAT | Admin/client login/logout/session, disabled user, cross-role and cross-client denial, recovery newest/reused/expired link | OPEN |
| DOC-13 live QA | Private read-back, eleven output families, version/current uniqueness, regeneration jobs, new-session downloads, masked lineage and orphan count | OPEN |
| Unattended automation | Apply the scheduler migration; configure separate matching Vercel/Vault secrets; explicitly activate Supabase Cron; verify authenticated minute invocation, bounded progress, safe overlap, retry and expired-lease recovery | OPEN |
| ATS provenance | Apply the snapshot migration; generate two reviewed career revisions; verify genuine versioned comparison, no 90-point floor, stale/cross-version withholding and service-role-only access | OPEN |
| Mobile-device QA | Mainstream phone/tablet/desktop interaction and horizontal-overflow evidence | OPEN |
| Human PDF visual QA | Long-content and Unicode visual inspection across output families and masked copy | OPEN |
| Database + Storage restore drill | Isolated restore with both DB and private object bytes; measured RTO/RPO and reviewer sign-off | OPEN |

No production deployment, migration repair, data cleanup or provider setting change is authorized by this register. Close items only with live evidence and a separate release decision. Current recommendation remains **NO-GO**.
