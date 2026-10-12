# Audit and logging standard

`public.security_audit_events` is prepared in the SEC-01 migration, which is not yet verified applied in production. The app writer is server-only, allowlists event types, writes actor/target/profile IDs and outcome, and stores empty metadata except controlled `detail_code` on client edits. It never writes CV text, email, phone, tokens, passwords or arbitrary request bodies. Audit insertion is **best effort** after a successful mutation; a sink failure returns false and does not replay the mutation. This is not a tamper-proof or comprehensive audit system. Until the migration is applied and alerts/retention are tested, audit coverage is a release risk.

| Event or source | What it covers | Limitation |
| --- | --- | --- |
| Supabase Auth provider logs | Login/recovery events visible to provider | Export/retention and alerting not verified; app does not record failed browser logins |
| `client.account.created/updated/disabled/reactivated` | Admin provisioning and lifecycle | `client.account.updated` uses `detail_code=package-assignment` when package changed, otherwise `profile-update`; combined changes are not itemized |
| `client.career.saved` | Client career-section write | No field values in event |
| `client.resume.replaced`, `client.photo.replaced` | Private intake replacement | Actor correlation; no object path or content |
| `resume.review.confirmed` | Admin acceptance of source review | Actor and profile correlation |
| `document.generated`, `document.privacy_generated` | PDF generation and masked export | No document bytes; production hooks only, coverage should be live-tested |
| `brand.settings.changed`, `recovery.password.updated` | Branding and successful recovery password update | No prior/new secret or password |

Use UTC timestamps and immutable IDs for correlation. Denials from route guards and failures before trusted actor identification are not generally inserted into this table; retain provider/hosting logs subject to access controls. A package assignment should be reviewed alongside the profile's authoritative database state. Review audit access quarterly; service-role grants require explicit verification. Recommend 12 months of controlled audit retention, then documented deletion/anonymization approval subject to contract/legal advice. No automated purge exists. Restrict read access to designated incident/audit operators and export only minimum fields. Database operators with privileged access can alter/delete rows; tamper resistance requires an independently retained export or external log sink, not currently implemented.
