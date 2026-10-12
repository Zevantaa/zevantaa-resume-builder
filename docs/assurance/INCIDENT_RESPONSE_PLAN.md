# Incident response plan

Owner: designated Sofiology incident commander; assign technical lead, privacy/business decision owner and communications approver per incident. This is not a 24/7 SOC commitment. Trigger on unauthorized access, leaked credentials, private-file exposure, data loss, malicious upload, repeated auth abuse or unavailable service.

| Severity | Example | Initial response target (aspirational, staffed hours) |
| --- | --- | --- |
| Critical | Confirmed broad candidate-data exposure or compromised server secret | Escalate immediately; same-day containment |
| High | Credible cross-client access, privileged compromise, failed restore | Same business day triage |
| Medium | Limited exploitable weakness without confirmed exposure | 2 business days triage |
| Low | Hardening issue with no direct exploit path | Next scheduled review |

Process: open restricted incident record with UTC timeline and minimum necessary IDs; preserve logs, relevant audit rows, deployment SHA and provider evidence before changing state. Contain by revoking sessions/roles, disabling affected flow or isolating deployment; rotate exposed Supabase/hosting/rate-limit credentials through controlled vault and redeploy, checking both browser bundles and server logs. Do not paste secrets or CV files into tickets. Assess scope, affected profiles/files, integrity, exfiltration likelihood and recovery point. Business/privacy owner decides notification obligations with qualified legal advice and contract terms; engineering does not assert a universal notification deadline. Restore from verified sources, test role and private-file boundaries, monitor recurrence, and perform a post-incident review with corrective actions and owners. Preserve chain of custody for externally reviewed evidence. SEC-01 open gates increase incident response uncertainty.
