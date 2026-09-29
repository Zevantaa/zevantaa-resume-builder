# Client core profile ownership

The protected admin provisioning and edit screens are authoritative for
`candidate_profiles.full_name`, `primary_email`, `mobile_number`,
`whatsapp_number`, `linkedin_url`, `current_location`,
`relocation_preference`, `selected_package_code`, and `target_markets`.
The admin can create one new candidate row during provisioning or reuse an
unlinked existing row; no parallel profile schema is created. A new row begins
without a source resume, which the client later uploads privately. The
admin-selected active package supplies the target-market array.
The profile email and Supabase Auth login email are kept in sync by the admin
workflow. A failed multi-step update attempts to restore the previous values;
if reconciliation cannot be confirmed, the admin is explicitly warned.

The client dashboard and `/client/profile` show these fields read-only.
Client Server Actions reject profile-field or package submissions, including
direct invocation of the former contact/details save actions. The only client
intake mutation is a private source-resume upload/replacement or optional GCC
photo upload/replacement. The authenticated user's active client-role linkage is
resolved server-side. Uploads do not parse or alter structured profile facts.

At successful provisioning, the temporary password exists only in the immediate
Server Action response and the administrator's current screen. It is not written
to the candidate profile, role row, logs, or welcome-message storage. The
administrator may copy a complete plain-text message for a **secure** delivery
channel. Manual email and WhatsApp drafts intentionally exclude the password
because URL contents can enter browser history, logs, and third-party services.
The password must be delivered separately and securely. The portal URL comes
from `NEXT_PUBLIC_APP_URL`; provisioning refuses to proceed if it is missing
or invalid.

The migration `20260929000100_admin_owned_profile_onboarding.sql` must be
applied before using **Create a new candidate profile**. It makes the initial
resume reference nullable; the first client upload fills it. It adds no
grants or RLS policies. A read-only check of the current Supabase project
confirmed that profile RLS is enabled and has no browser policies.

## Approved future ATS rule

No ATS scoring is implemented in this workflow batch. The eventual internal
indicative score remains 0–100. **90 is an optimization/pass benchmark, not a
minimum displayed score.** Never use `Math.max(score, 90)` or any other
upward score floor. The score is not a third-party ATS result, certification,
or employment guarantee.
