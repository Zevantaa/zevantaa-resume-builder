# Production release orchestrator dry-run results

- Date: 11 November 2026
- Mode: `DryRun`
- Branch: `feature/premium-uiux-document-upgrade`
- Commit under test: `dea935994a0518752f3f20a514371c82ff8f5ada`
- Production target: `https://ats.zevantaacareers.com`
- Supabase target: `fzltowzpfrnuxxxrzuih`
- Production changes made: **None**

## Result

**FAIL / production release blocked, with the dry-run mechanism operating as
designed.** The orchestrator completed every local validation successfully and
proved GitHub access through a non-mutating dry-run push. It then stopped the
production path because the current Supabase identity is not authorized for the
Zevantaa project and this checkout is not linked to the existing Zevantaa Vercel
project.

The report was generated outside Git under the operator's temporary directory. It
was not committed because release evidence can contain operational metadata and
future release evidence will contain database rows and private file bytes.

## Passed

- Approved Zevantaa branch and Git origin.
- Development dry-run commit check; the dirty-tree override was used only because
  the new orchestrator files had not yet been committed.
- Complete regression suite.
- ESLint.
- TypeScript.
- Optimized production build.
- Repository secret scan.
- Production dependency audit with zero vulnerabilities.
- Git whitespace check.
- GitHub repository read access and dry-run push authorization.
- Cron remained inactive; the script contains no activation call.

## Blockers discovered

1. **Supabase authorization:** the currently authenticated CLI identity can list
   projects, but the authorized set does not contain `fzltowzpfrnuxxxrzuih`.
   No database query, dump, migration comparison, repair, or write was attempted.
2. **Vercel project identity:** `.vercel/project.json` is absent. The orchestrator
   therefore cannot prove that a CLI operation would target the existing Zevantaa
   project behind `ats.zevantaacareers.com`; it refuses to infer or create one.
3. **Backup/restore tooling:** Docker was available, but PostgreSQL `psql` was not
   installed on PATH. The release mode will not begin provider mutations without
   both tools.
4. **Expected dry-run holds:** production backup/restore, live migration
   equivalence, official history repair, invitation migration, Auth/SMTP
   attestation, production deployment, and post-deployment smoke tests were not
   executed in DryRun mode.

## Next safe setup

1. Authenticate Supabase CLI with a Zevantaa-owned scoped token that grants
   `projects_read` and `database_read` to `fzltowzpfrnuxxxrzuih`. Grant database
   write only for the separately authorized release window.
2. From this checkout, run the pinned Vercel CLI's interactive link flow and select
   the already-existing Zevantaa project. Abort if the project is not listed; never
   create a replacement project. Record the approved project ID outside Git.
3. Install PostgreSQL `psql` on PATH, confirm Docker remains available, then rerun
   DryRun without `-AllowDirtyWorkingTree` against the final committed SHA.
4. Complete the two secret-free attestations from
   `PRODUCTION_RELEASE_ACCESS_CHECKLIST.md` before requesting Release mode.

These are access/setup actions only. Do not link a Sofiology project, apply SQL,
repair history, deploy, or activate Cron while closing these blockers.
