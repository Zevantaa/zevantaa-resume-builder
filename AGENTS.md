# Zevantaa Resume Builder — Development Guardrails

This repository contains the Zevantaa Careers custom multi-market resume builder and admin dashboard.

## Core rule
Build only the confirmed V1 scope. Do not add features, roles, integrations, workflows, fields, templates, or dependencies that are not explicitly required.

## Product boundaries
The application includes:
- One Zevantaa master administrator login.
- Admin-created client accounts; no public self-registration.
- Client login and dashboard.
- Structured candidate intake and profile editing.
- Existing resume upload: DOC, DOCX, PDF.
- Optional professional photograph where required for GCC output.
- Seven package configurations.
- Eight resume layouts.
- Three cover-letter formats.
- Basic internal indicative ATS score from 0–100.
- Admin client directory and document access.
- Employer-review privacy-masked export replacing phone, email and LinkedIn with Zevantaa routing/reference details.
- Responsive desktop, tablet and mobile interface.

## Explicitly out of scope for V1
Do not implement:
- Client self-registration.
- Multiple administrator roles or staff permission tiers.
- Payment gateways, subscriptions or invoicing.
- CRM, job-board, recruiter, employer, WhatsApp or other third-party integrations.
- Paid AI rewriting or paid generative-content dependencies.
- Advanced semantic parsing or paid ATS-scanning services.
- Native Android or iOS applications.
- Additional resume or cover-letter layouts beyond the confirmed set.
- Bulk historical-data migration.
- Ongoing maintenance functionality that is not part of the application itself.

## Technical guardrails
- Prefer a simple, maintainable architecture over unnecessary abstraction.
- No paid AI API may be required for production operation.
- No paid parsing or document-generation platform may be required within V1.
- Use environment variables for secrets. Never commit production credentials, service keys, tokens or passwords.
- Keep staging and production configuration separate.
- Validate all uploads and enforce file-type and file-size controls.
- Treat candidate information, resumes, photographs and generated documents as confidential data.
- Apply least-privilege access rules in the database and storage layer.
- Do not expose private candidate files through public URLs.

## Data rule
The structured candidate profile stored in the application is the authoritative source for document generation after any imported resume data is reviewed/corrected.

## Document-generation rule
Resume and cover-letter templates must consume the structured candidate profile. Do not create separate duplicate candidate data stores for each template.

## ATS scoring rule
The ATS score is an internal indicative score only. It must not be represented as a third-party ATS score, certification, guarantee, or prediction of selection.

## Privacy-masking rule
The employer-review export must create a separate output and must not overwrite the candidate's original stored profile or original generated document.

## Branding
Use Zevantaa Careers branding consistently. Keep the interface corporate, restrained and professional. Do not invent new brand assets or alter the approved logo.

## Development workflow
- `main` = stable baseline / reviewed code.
- `develop` = active integration branch.
- Feature work should use short-lived feature branches where practical.
- Do not commit directly to `main` for substantive application work.
- Keep commits focused and descriptive.
- Run validation/tests before merging substantial changes.

## Delivery principle
The delivered Zevantaa instance must be operable independently after handover, including source code, deployment configuration and administrator access. Avoid vendor lock-in.
