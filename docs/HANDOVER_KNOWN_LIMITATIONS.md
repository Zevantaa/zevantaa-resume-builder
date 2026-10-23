# Known limitations and unresolved gates

Classification matters: **V1 design limitation** describes the intended implementation, **temporary release gate** blocks production until evidence/approval, and **out of scope** is not a defect to close inside frozen V1. No item below is cleared by writing this page. Refer to the [manual gate register](REL_01_MANUAL_RELEASE_GATES.md) for current release status.

| Item | Class | Handover implication |
| --- | --- | --- |
| No always-on regeneration worker; bounded request-driven processing | V1 design limitation | Career saves/authorized library visits can schedule limited jobs; idle queues need operator monitoring. Do not claim unattended processing. |
| Legacy generated rows with null output identity | Temporary release gate | Identity cannot be guessed. Review and reconcile before treating historical rows as current client outputs. |
| DOC-13 migration filename/history timestamp discrepancy | Temporary release gate | Both DOC-13 SQL bodies were recorded under later remote versions; do not replay. Complete the 15-row equivalence/reconciliation review. |
| Production domain, Vercel variables, Supabase Auth/Storage, SMTP and live QAT | Temporary release gate | Provider/manual evidence is OPEN; no production-live claim. |
| Admin MFA not implemented/enforced | Temporary release gate | Enrollment/challenge and `aal2` enforcement require implementation plus live verification; a role-only switch is not enough. |
| Leaked-password protection previously observed disabled | Temporary release gate | Provider owner must enable and retest or record an explicit release-risk decision. Do not treat it as active. |
| GitHub rulesets reportedly not enforceable on current private-repository plan | Temporary release gate | Confirm current plan/effective rules; upgrade or approve a compensating control. No protection is attested here. |
| Manual mobile/tablet/desktop device QA and human PDF visual QA | Temporary release gate | Automated layout/PDF tests are not device or visual acceptance evidence. |
| Timed database **and** private Storage restore drill | Temporary release gate | A database backup alone misses object bytes; no achieved RTO/RPO is claimed. |
| No paid AI rewriting/semantic inference or third-party ATS guarantee | Out of scope | Extraction and cover-letter/ATS rules remain deterministic and fact-grounded; score is indicative only. |
| No CRM, payment, WhatsApp-provider or job-board integration | Out of scope | Manual communication links are not an automated provider integration. |

The [DOC-13 design](DOC_13_PERSISTENT_DOCUMENT_DELIVERY.md), [production preparation](REL_01_PRODUCTION_PREPARATION.md), [dependency risk register](security/DEPENDENCY_AND_SUPPLY_CHAIN.md) and [manual gates](REL_01_MANUAL_RELEASE_GATES.md) hold the detailed evidence and remediation decisions. Current recommendation is **NO-GO** until the release owner closes blocking gates with live evidence; REL-02 and final acceptance are not started by this handover preparation.
