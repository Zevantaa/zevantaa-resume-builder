# Changelog

Record reviewed user-visible, security, schema and operational changes here before each release. Entries remain **Unreleased** until a dated deployment with a recorded commit SHA and approval. A merge is not evidence of deployment.

## Unreleased

- ASSUR-01: environment validation, CI security/evidence workflow, controlled package-assignment audit detail, governance/DR/incident/client-trust documentation, and negative assurance tests. No remote settings or schema migrations applied.
- ASSUR-01 dependency triage: pinned Mammoth's transitive CLI parser to `argparse@2.0.1`, preserving DOCX extraction while clearing the production dependency audit; five development-only `braces` findings remain visible for upstream follow-up.
