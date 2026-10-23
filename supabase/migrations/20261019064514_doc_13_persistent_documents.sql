-- DOC-13 enum additions are isolated from their first use in the next migration.
-- PostgreSQL cannot use a newly added enum value in the same transaction.
alter type public.file_purpose add value if not exists 'generated-document';
alter type public.document_status add value if not exists 'outdated';
alter type public.document_status add value if not exists 'superseded';
