-- Private source-resume and optional GCC-photo storage. Only trusted server
-- code uses the service key; no authenticated/anonymous object policy is added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-intake-private',
  'candidate-intake-private',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
);
