# Environment and release management

Owner: Sofiology engineering/release owner. This is an operating standard, not proof that preview or production is deployed.

| Environment | Purpose | Configuration boundary | Data rule |
| --- | --- | --- | --- |
| Local | Developer work and fictional fixtures | `.env.local`, localhost, developer Supabase project if needed | No production exports or secrets |
| Preview/staging | Candidate release validation | Separate deployment variables, HTTPS origin and ideally separate Supabase project | Synthetic or explicitly approved de-identified data |
| Production | Authorized client use | Dedicated HTTPS origin, production Supabase project, server-only secret and rate-limit key | Real data only under approved operations |

Run `npm run environment:validate -- <local|preview|production>` with that environment's variables before deployment. It checks required variables, placeholders, HTTPS URLs, public-key separation and a 32-character rate-limit key. It cannot verify Supabase dashboard settings, key strength/uniqueness, project isolation or actual redirect allowlists; record those manually. `NEXT_PUBLIC_*` is exposed to browsers. Never copy `.env.local` into CI or publish secret/service-role keys. Legacy `SUPABASE_SERVICE_ROLE_KEY` fallback exists in code; use the documented `SUPABASE_SECRET_KEY` for new environments. `DEPLOYMENT_ENV` is a release-validation selector, not an authorization role or runtime security boundary.

Changes flow through `develop` pull requests with tests, reviewer, change summary and migration impact. Record version/date, operator, commit, affected environments, migration order, user-visible behavior, security impact, rollback plan and QA evidence in a release record. Promote the same reviewed commit to production only after the [release checklist](RELEASE_CHECKLIST.md) is signed. Keep changelog entries for behavior/security changes; do not infer deployment from a Git merge. Production configuration or migrations require a separately authorized change window and recorded verification. Follow [rollback](ROLLBACK_PROCEDURE.md) on failure.
