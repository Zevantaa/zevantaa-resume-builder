# Deterministic V1 cover letters (DOC-12-01–06)

Three cover-letter outputs use the reviewed canonical `CandidateProfile` through
`mapCandidateProfileToDocumentData(profile, "cover-letter")`. The pure
`buildCoverLetterContent` assembles factual, ordered prose with `sourcePaths`
for every factual paragraph; `buildCoverLetterModel` places it into one common
A4 business-letter PDF. Neither builder queries Supabase, calls AI, rewrites
candidate claims, or creates a second profile store.

## Variants and source rules

| Variant | Deterministic content strategy |
| --- | --- |
| General Corporate | Neutral opening; most recent recorded role and employer, up to three stored skills, at most one concise verbatim role sentence, and short education/certification support where present. |
| International Relocation | Same professional base. Only an explicit `open` or `conditional` preference yields one factual relocation sentence; `not-open` or `not-specified` yields none. Languages are omitted because no target role is stored against which to assess relevance. |
| Technology & Startup | Same professional base. One explicitly stored project and at most one listed technology may be mentioned. With no project/technology, it remains a general professional letter; it does not label generic operations experience as software expertise. |

The role selector takes the latest explicitly current role first, otherwise
the role with the most recent stored start month. It preserves the complete
role title and employer but omits role location from prose. Other child sections stay in the
canonical mapper's `(sortOrder, id)` order. The letter uses only reviewed name,
email, mobile, optional LinkedIn/current location, summary, employment,
education, skills, certifications and projects. It does not invent
a target company, recruiter, job posting, achievement, metric, skill,
motivation, technology, nationality, visa status, work rights or sponsorship
eligibility. Generic salutation and closing phrases are fixed letter framing,
not candidate facts. There is no recipient placeholder or `N/A` block.

The content object exposes `sourcePaths` such as `professionalSummary.text`,
`employment.<id>`, and `projects.<id>.technologies.<index>` for factual
sentences. These are transient provenance references, not printed candidate
IDs or persisted letter records. Paragraph text is deterministic for the same
mapped profile and chosen variant. The builder uses a complete supplied summary
only when it is concise and free of QA provenance phrases such as
`Candidate-supplied`. It selects at most one complete responsibility or
highlight sentence (160 characters or less) from the chosen role. Longer text
is omitted, not truncated or paraphrased, because a clipped clause could
change its meaning. Skills are limited to three short exact names; lengthy
education/certification labels are omitted rather than shortened. It does not
pad short profiles to a word count. A strong profile may provide more evidence,
but the 250–350-word target is secondary to factual accuracy and readability.

## Readiness and entitlement

The canonical mapper must first have no blocking findings: name, primary
email, mobile, package, target market, plus some summary or career context.
The letter builder applies a stricter credibility check: a substantive summary
(at least seven words and 40 characters), a recorded role with title/employer,
a named project with description, or education with at least one skill. A lone
skill or language cannot produce a credible letter, even if the generic mapper
accepts it. Such profiles return a not-ready state rather than filler prose.
Missing optional details simply disappear.

The frozen TypeScript package catalog has **no** cover-letter configuration
reference on any of the seven packages, and the existing seed rows likewise
set `cover_letter_configuration_ref` to null. The frozen project scope grants
“all included outputs” explicitly to Executive All-Inclusive; it does not
explicitly grant cover letters to the other six. To avoid inventing
entitlements, DOC-12 conservatively allows only the active
`executive-transition-agency-distribution` catalog code. The other six and
unknown codes fail closed. If product policy later authorizes broader package
entitlement, the package catalog and persisted definitions should be updated
explicitly in a separately approved task, not inferred by this template.

## PDF and access

Each variant shares a restrained A4 layout: selectable/searchable text,
candidate name/contact, fine rule, neutral salutation, opening, one or two
evidence paragraphs when present, closing and sign-off. The default recipient
is “Dear Hiring Manager,”; no fake company or recruiter appears. Long supplied
text flows across pages naturally. There is no forced one-page limit or
image-based text. The existing filename helper produces:

- `<Candidate_Name>_General_Corporate_Cover_Letter.pdf`
- `<Candidate_Name>_International_Relocation_Cover_Letter.pdf`
- `<Candidate_Name>_Technology_Startup_Cover_Letter.pdf`

The protected `/admin/clients/[userId]/cover-letters` page shows readiness and
the three download options. The POST-only `/download` route rechecks admin
access via the existing canonical loader, reloads reviewed candidate data,
accepts only a known cover-letter type, rejects mismatched origins, ignores
submitted facts and returns the PDF through the existing private, no-store
download helper. PDFs are transient/in-memory; no public URL or new storage
object is created. The unlinked admin-only `/admin/pdf-render-test` harness
offers three fixed fictional letters and a sparse fixture that deliberately
returns HTTP 422. No migration or Supabase policy change is needed.

## QA and limitations

PDF.js regression checks validity, selectable text, A4 size, source facts,
negative unsupported-claim patterns, normal one-page output, overlong-source
omission, filenames, package refusal, signed-out/client denial, canonical reload,
form tampering and sparse not-ready behavior. Visual/manual review is still
needed for real candidate wording, grammatical fragments in short supplied
summaries or descriptions, viewer-specific wrapping, complex scripts and accessibility.
The templates cannot know the recipient, target role or company because those
are not canonical V1 fields. They are general introductions, not personalized
job-application letters or AI-generated persuasion. DSH-01 is not part of this
work.
