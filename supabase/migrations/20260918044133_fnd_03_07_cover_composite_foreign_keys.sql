begin;

create index candidate_profiles_existing_resume_file_fk_idx
  on public.candidate_profiles (id, existing_resume_file_id);

create index candidate_profiles_gcc_photo_file_fk_idx
  on public.candidate_profiles (id, gcc_photo_file_id);

create index document_records_file_record_fk_idx
  on public.document_records (candidate_profile_id, file_record_id);

create index document_records_privacy_mask_source_fk_idx
  on public.document_records (
    candidate_profile_id,
    privacy_mask_source_document_id
  );

create index file_records_replaces_file_fk_idx
  on public.file_records (candidate_profile_id, replaces_file_id);

commit;
