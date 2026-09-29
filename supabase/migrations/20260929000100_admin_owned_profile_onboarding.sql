-- Admin provisioning may create a candidate before that client uploads a source resume.
-- The existing composite FK still verifies ownership when a file is later linked.
alter table public.candidate_profiles
  alter column existing_resume_file_id drop not null;

comment on column public.candidate_profiles.existing_resume_file_id is
  'Nullable until the client uploads a private source resume; required by the intake save flow before resume processing.';
