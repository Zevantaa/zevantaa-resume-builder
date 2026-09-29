# Synthetic legacy DOC parser fixture

`legacy-doc-generic.doc.gz.b64` is a gzip-compressed, base64-encoded copy of
`test09.doc` from the MIT-licensed `morungos/node-word-extractor` test corpus:
https://github.com/morungos/node-word-extractor/blob/develop/__tests__/data/test09.doc

It contains only generic parser-test sentences (no client, employee, or other
personal data). The test inflates it in memory; it is not an uploaded resume.
The upstream fixture supplies a genuine OLE Word binary so the DOC test runs
offline without installing Microsoft Word or LibreOffice.

DOCX and PDF fixtures are generated in memory with fictional text in the
extraction tests. No test opens a public storage URL or persists candidate data.
