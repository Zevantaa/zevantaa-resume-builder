# Privacy-masked employer resume (DSH-04)

## Purpose and scope

The frozen V1 employer-review copy is a separate, on-demand PDF. It uses the
reviewed canonical candidate profile and the Global ATS single-column layout.
The scope describes one employer copy generically, not a masked variant of all
eight designs. Global ATS is included in every active V1 package, so this is
an administrator operational export for all seven packages; it is not a new
package entitlement or a client-facing download. Unknown/inactive package
codes still fail the existing Global ATS entitlement check.

## Source, mask, output

`loadAdminCandidateProfile(userId)` verifies active administrator access and
resolves the candidate from the stored `user_roles` linkage. The browser sends
no profile ID or candidate facts. The existing canonical mapper produces one
ordered document projection. `buildPrivacyMaskedEmployerResume` creates a new
projection with the candidate's primary email, mobile, WhatsApp and LinkedIn
removed **before** the common Global ATS builder and renderer run. Its identity
block includes the name, any stored current location, Zevantaa Careers, the
reference ID and the instruction:

> For candidate contact, please route communication through Zevantaa Careers
> and quote the reference above.

No unapproved Zevantaa email, telephone number, domain or address is inserted.
The employer copy retains the professional summary, employment, education,
skills, certifications, projects, languages and additional sections in their
canonical order. Location is retained because the frozen mask does not include
it. The rest of the Global ATS page flow, text-based PDF rendering and section
omission rules remain unchanged.

The transformation is pure: neither the database profile, mapper result nor
normal candidate PDF model is mutated. The ordinary Global ATS resume continues
to contain the candidate's supplied contact information. A regression generates
normal, masked and normal models in sequence and compares both normal outputs
and the source data. The masked PDF is transient: it is not uploaded to Storage
and creates no `file_records` or `document_records` row. The existing document
record model already supports a future persisted masked derivative, but this
batch does not claim such a record exists. No migration is required.

## Candidate reference

Format: `ZV-CAN-` followed by 20 uppercase hexadecimal characters. It is the
first 80 bits of SHA-256 over a versioned namespace and the canonical random
candidate-profile UUID. It is stable for that profile, non-sequential and does
not directly reveal the UUID, auth identity, email or phone. It is not derived
from PII. The namespace/version must not be changed casually because doing so
would change previously issued references. The 80-bit space has a negligible
birthday-collision probability at V1 scale; tests check 1,000 distinct fixture
IDs. There is no silent collision overwrite because nothing is persisted. If a
collision is ever observed, stop issuing affected exports and introduce a
reviewed, longer versioned reference before continuing; do not guess which
candidate a recruiter intended.

The download filename uses the reference rather than the candidate name:
`ZV_CAN_<digest>_Global_ATS_Resume_Masked.pdf`. It is built and sanitized by
the existing filename/download helpers. This deliberately keeps direct PII
out of the filename while preserving the existing approved masked naming rule.

## Security and limitations

The POST-only route is
`/admin/clients/[userId]/global-ats/privacy-masked/download`. It repeats the
server-side role, linkage and package checks through the existing admin loader,
rejects cross-origin requests and returns a private `no-store` PDF attachment.
It does not expose a Storage path, public URL, service key or PDF payload to the
browser for generation. The client portal has no link or route to this export.

The mask removes the four structured direct-contact fields. A pre-render guard
also refuses export when known candidate contacts or recognizable email,
LinkedIn or telephone patterns appear in supplied career text, rather than
silently editing candidate facts. Free-form content can contain unusual contact
obfuscations the deterministic guard cannot recognize. Administrator review of
the generated employer PDF remains necessary before distribution. In particular,
candidate name and current location are intentionally retained, so this is a
contact-routing mask, **not** full anonymization. There is no guarantee against
all re-identification through career history.

Automated QA checks one-page and multi-page text-based PDFs, all four removed
routes, retained career sections, a reference-only filename, normal-output
preservation, forged payload rejection, missing/mismatched linkage, cross-origin
rejection and denied client/signed-out access. Before operational use, manually
download both PDFs for a fictional client and inspect every page for visual
overflow and direct contact details, including any free-text sections.
