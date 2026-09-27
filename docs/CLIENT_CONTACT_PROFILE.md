# Client intake fields (FND-06-01–07)

The protected `/client/profile` screen edits only `candidate_profiles.full_name`,
`primary_email`, `mobile_number`, and `whatsapp_number` for the active client's
linked candidate profile. The server resolves the profile through the authenticated
user's active `client` role; the browser does not supply a profile ID. The save
action validates and normalizes these four values before updating them.

`candidate_profiles.primary_email` is the candidate's contact email. It may differ
from the Supabase Auth login email. Editing it on this screen does **not** change
the Auth user's email or login credentials. Account email administration remains
in the protected admin client-edit workflow.

The same permanent profile card now has a second limited save path for
`linkedin_url`, `current_location`, and `relocation_preference`. LinkedIn is
optional; location is required; relocation uses the four values already defined
by the frozen schema. Both save actions resolve the client's linked profile on
the server and never accept a browser-supplied profile ID.

The package field loads the seven definitions from `package_definitions` in
`sort_order` and shows the currently assigned package and its authoritative
target markets. It is read-only for clients because V1 account provisioning and
package assignment are administrator-managed. The client save action rejects
any submitted package or target-market change; only the protected admin edit
workflow can make that change and validate an active package code.

These are limited field saves, not the full intake save/update workflow
(FND-06-10). Uploads and later intake sections are not included.
