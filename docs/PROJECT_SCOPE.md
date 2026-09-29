# Zevantaa Resume Builder — Frozen V1 Scope

## Project
Custom Multi-Market Resume Builder and Admin Dashboard for Zevantaa Careers Private Limited.

## User access
- Clients do not self-register.
- Zevantaa creates client accounts through the master administrator dashboard.
- Zevantaa provides each client with portal credentials.
- One master administrator login is included.

## Client intake
The application supports:
- Full name.
- Primary email address.
- Mobile number.
- WhatsApp number.
- LinkedIn profile URL.
- Current location and relocation preference.
- Package / target market selection.
- Existing resume upload in DOC, DOCX or PDF.
- Optional professional passport-size photograph for relevant GCC output.

## Packages
Seven package configurations are in scope:
1. Indian Domestic Market.
2. GCC and Middle East Market.
3. Europass and European Union Market.
4. Dual Market Regional Combo — Domestic + GCC.
5. Dual Market Regional Combo — Domestic + Europass / European Union.
6. Global Mobility Master Combo — Domestic + GCC + Europass.
7. Executive Transition and Agency Distribution Package — all included outputs.

## Resume outputs
Eight resume layouts are in scope:
1. Global ATS Resume — clean single-column layout with an indicative ATS score displayed on the dashboard.
2. Domestic Resume 1 — classic executive two-column layout.
3. Domestic Resume 2 — modern minimalist single-column layout.
4. Domestic Resume 3 — high-density corporate grid.
5. Domestic Resume 4 — bold header and accent-block layout.
6. Domestic Resume 5 — hybrid functional-chronological layout.
7. GCC and Middle East Resume — regional layout with conditional candidate photograph.
8. European Resume — Europass-style European market layout based on the approved design structure.

## Cover letters
Three formats are in scope:
- General Corporate Cover Letter.
- International Relocation Cover Letter.
- Technology and Startup Roles Cover Letter.

## Document generation
- Structured candidate information maps into relevant outputs according to the assigned package.
- Supported resume uploads may be processed using open-source extraction methods.
- Inconsistent, scanned, protected or poorly structured files may require review and correction.
- The saved structured profile is the final source used for generation.
- PDF outputs are generated using suitable open-source or browser-based rendering methods.

## ATS score
- Basic indicative score from 0–100.
- 90 is the optimization/pass benchmark, not a minimum displayed score.
- Never force a score upward with `Math.max(score, 90)` or an equivalent floor.
- Calculated using internal keyword and formatting rules.
- Must not be represented as a third-party ATS provider score or guarantee of selection.

## Admin dashboard
The master administrator can:
- Create client accounts.
- Review client profiles.
- Assign packages.
- View the master client directory.
- Access generated files.
- Download client documents.
- Trigger employer-review privacy masking.

## Privacy masking
Employer-review export creates a separate privacy-masked resume in which:
- Candidate phone number is replaced with Zevantaa contact routing/reference information.
- Candidate email address is replaced with Zevantaa contact routing/reference information.
- Candidate LinkedIn URL is replaced with Zevantaa contact routing/reference information.

## Interface and deployment
- Zevantaa-branded login and dashboards.
- Responsive across mainstream desktop, tablet and mobile sizes.
- Suitable free-tier hosting, authentication, database and storage services may be used.
- Production operation must not require paid AI APIs, paid parsing services or paid document-generation platforms within V1.

## Not included
- Client self-registration.
- Multiple administrator roles or additional staff permission levels.
- Payment gateway, subscription billing or automated invoicing.
- CRM, job-board, recruiter, employer, WhatsApp or other third-party integrations.
- Paid AI rewriting or advanced generative-content functionality.
- Advanced semantic resume parsing or third-party ATS scanning.
- Native Android or iOS applications.
- Additional resume or cover-letter layouts.
- Bulk migration or manual correction of historical client data.
- Ongoing maintenance, monitoring, hosting upgrades, content entry or post-handover enhancements.

## Scope-control rule
Any functionality not described above is treated as a future enhancement and must not silently enter V1 development.
