# Client contact profile (FND-06-01–04)

The protected `/client/profile` screen edits only `candidate_profiles.full_name`,
`primary_email`, `mobile_number`, and `whatsapp_number` for the active client's
linked candidate profile. The server resolves the profile through the authenticated
user's active `client` role; the browser does not supply a profile ID. The save
action validates and normalizes these four values before updating them.

`candidate_profiles.primary_email` is the candidate's contact email. It may differ
from the Supabase Auth login email. Editing it on this screen does **not** change
the Auth user's email or login credentials. Account email administration remains
in the protected admin client-edit workflow.

This is a limited save path for the first four intake fields, not the full intake
save/update workflow (FND-06-10). Uploads and later intake fields are not included.
