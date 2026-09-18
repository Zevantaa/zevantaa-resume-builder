begin;

-- Stable catalog ordering and composite ownership keys used by same-candidate
-- foreign keys below.
alter table public.package_definitions
  add constraint package_definitions_sort_order_key unique (sort_order);

alter table public.file_records
  add constraint file_records_candidate_profile_id_id_key
  unique (candidate_profile_id, id);

alter table public.document_records
  add constraint document_records_candidate_profile_id_id_key
  unique (candidate_profile_id, id);

-- Package relationships preserve assigned package history while allowing a
-- stable package code correction to propagate.
alter table public.candidate_profiles
  add constraint candidate_profiles_selected_package_code_fk
  foreign key (selected_package_code)
  references public.package_definitions (code)
  on update cascade
  on delete restrict;

alter table public.document_records
  add constraint document_records_package_code_fk
  foreign key (package_code)
  references public.package_definitions (code)
  on update cascade
  on delete restrict;

-- Candidate-owned profile sections are preserved on attempted physical parent
-- deletion. Normal removal uses the existing archive fields.
alter table public.profile_work_experiences
  add constraint profile_work_experiences_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.profile_education_entries
  add constraint profile_education_entries_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.profile_skills
  add constraint profile_skills_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.profile_certifications
  add constraint profile_certifications_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.profile_languages
  add constraint profile_languages_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.profile_projects
  add constraint profile_projects_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.additional_profile_sections
  add constraint additional_profile_sections_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.additional_profile_section_items
  add constraint additional_profile_section_items_section_fk
  foreign key (additional_profile_section_id)
  references public.additional_profile_sections (id)
  on update cascade
  on delete restrict;

-- File and document ownership relationships. Composite references guarantee
-- that related files/documents belong to the same candidate profile.
alter table public.file_records
  add constraint file_records_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.file_records
  add constraint file_records_replaces_file_fk
  foreign key (candidate_profile_id, replaces_file_id)
  references public.file_records (candidate_profile_id, id)
  on update cascade
  on delete restrict;

alter table public.document_records
  add constraint document_records_candidate_profile_fk
  foreign key (candidate_profile_id)
  references public.candidate_profiles (id)
  on update cascade
  on delete restrict;

alter table public.document_records
  add constraint document_records_file_record_fk
  foreign key (candidate_profile_id, file_record_id)
  references public.file_records (candidate_profile_id, id)
  on update cascade
  on delete restrict;

alter table public.document_records
  add constraint document_records_privacy_mask_source_fk
  foreign key (candidate_profile_id, privacy_mask_source_document_id)
  references public.document_records (candidate_profile_id, id)
  on update cascade
  on delete restrict;

-- These two references complete a deliberate cycle: a profile owns its file
-- records, while the profile points at its selected source resume/photo. The
-- deferred checks allow the required source resume and its profile to be
-- inserted in one transaction.
alter table public.candidate_profiles
  add constraint candidate_profiles_existing_resume_file_fk
  foreign key (id, existing_resume_file_id)
  references public.file_records (candidate_profile_id, id)
  on update cascade
  on delete restrict
  deferrable initially deferred;

alter table public.candidate_profiles
  add constraint candidate_profiles_gcc_photo_file_fk
  foreign key (id, gcc_photo_file_id)
  references public.file_records (candidate_profile_id, id)
  on update cascade
  on delete restrict
  deferrable initially deferred;

-- Record-level integrity that mirrors the existing TypeScript discriminated
-- unions without introducing triggers or application behaviour.
alter table public.profile_work_experiences
  add constraint profile_work_experiences_current_role_check
  check (not is_current_role or end_date is null);

alter table public.file_records
  add constraint file_records_no_self_replacement_check
  check (replaces_file_id is null or replaces_file_id <> id),
  add constraint file_records_version_replacement_check
  check (
    (version_number = 1 and replaces_file_id is null)
    or (version_number > 1 and replaces_file_id is not null)
  ),
  add constraint file_records_purpose_format_check
  check (
    (purpose = 'source-resume' and (
      (mime_type = 'application/pdf' and file_extension = 'pdf')
      or (mime_type = 'application/msword' and file_extension = 'doc')
      or (
        mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        and file_extension = 'docx'
      )
    ))
    or (purpose = 'gcc-profile-photo' and (
      (mime_type = 'image/jpeg' and file_extension in ('jpg', 'jpeg'))
      or (mime_type = 'image/png' and file_extension = 'png')
      or (mime_type = 'image/webp' and file_extension = 'webp')
    ))
  ),
  add constraint file_records_storage_lifecycle_check
  check (
    (
      status in ('pending', 'uploading', 'failed')
      and stored_file_name is null
      and storage_bucket_name is null
      and storage_object_key is null
      and uploaded_at is null
    )
    or (
      status in ('available', 'replaced')
      and stored_file_name is not null
      and storage_bucket_name is not null
      and storage_object_key is not null
      and uploaded_at is not null
    )
  );

alter table public.document_records
  add constraint document_records_no_self_privacy_source_check
  check (
    privacy_mask_source_document_id is null
    or privacy_mask_source_document_id <> id
  ),
  add constraint document_records_category_origin_check
  check (
    (
      category = 'source-resume'
      and origin = 'uploaded'
      and resume_format_family is null
      and cover_letter_type is null
      and not is_privacy_masked
      and privacy_mask_source_document_id is null
      and generated_at is null
    )
    or (
      category = 'resume'
      and origin = 'generated'
      and package_code is not null
      and resume_format_family is not null
      and cover_letter_type is null
    )
    or (
      category = 'cover-letter'
      and origin = 'generated'
      and package_code is not null
      and resume_format_family is null
      and cover_letter_type is not null
      and not is_privacy_masked
      and privacy_mask_source_document_id is null
    )
  ),
  add constraint document_records_privacy_mask_check
  check (
    (
      is_privacy_masked
      and category = 'resume'
      and origin = 'generated'
      and privacy_mask_source_document_id is not null
    )
    or (
      not is_privacy_masked
      and privacy_mask_source_document_id is null
    )
  ),
  add constraint document_records_naming_check
  check (
    (
      origin = 'generated'
      and file_name_stem is not null
      and file_extension is not null
      and file_extension = 'pdf'
    )
    or (
      origin = 'uploaded'
      and (
        (file_name_stem is null and file_extension is null)
        or (file_name_stem is not null and file_extension is not null)
      )
    )
  ),
  add constraint document_records_file_lifecycle_check
  check (
    (category <> 'source-resume' or file_record_id is not null)
    and (status <> 'available' or file_record_id is not null)
    and (exported_at is null or origin = 'generated')
  );

-- Archive metadata may only name an actor/reason after an archive timestamp is
-- present. A null actor remains valid for trusted system actions.
alter table public.package_definitions
  add constraint package_definitions_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.candidate_profiles
  add constraint candidate_profiles_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.profile_work_experiences
  add constraint profile_work_experiences_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.profile_education_entries
  add constraint profile_education_entries_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.profile_skills
  add constraint profile_skills_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.profile_certifications
  add constraint profile_certifications_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.profile_languages
  add constraint profile_languages_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.profile_projects
  add constraint profile_projects_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.additional_profile_sections
  add constraint additional_profile_sections_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.additional_profile_section_items
  add constraint additional_profile_section_items_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.file_records
  add constraint file_records_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

alter table public.document_records
  add constraint document_records_archive_fields_check
  check (
    archived_at is not null
    or (archived_by_user_id is null and archive_reason is null)
  );

-- Foreign-key support and expected V1 lookup paths.
create index candidate_profiles_selected_package_code_idx
  on public.candidate_profiles (selected_package_code);

create index candidate_profiles_existing_resume_file_id_idx
  on public.candidate_profiles (existing_resume_file_id);

create index candidate_profiles_gcc_photo_file_id_idx
  on public.candidate_profiles (gcc_photo_file_id)
  where gcc_photo_file_id is not null;

create index profile_work_experiences_candidate_sort_idx
  on public.profile_work_experiences (candidate_profile_id, sort_order);

create index profile_education_entries_candidate_sort_idx
  on public.profile_education_entries (candidate_profile_id, sort_order);

create index profile_skills_candidate_sort_idx
  on public.profile_skills (candidate_profile_id, sort_order);

create index profile_certifications_candidate_sort_idx
  on public.profile_certifications (candidate_profile_id, sort_order);

create index profile_languages_candidate_sort_idx
  on public.profile_languages (candidate_profile_id, sort_order);

create index profile_projects_candidate_sort_idx
  on public.profile_projects (candidate_profile_id, sort_order);

create index additional_profile_sections_candidate_sort_idx
  on public.additional_profile_sections (candidate_profile_id, sort_order);

create index additional_profile_section_items_section_sort_idx
  on public.additional_profile_section_items (
    additional_profile_section_id,
    sort_order
  );

create index file_records_replaces_file_idx
  on public.file_records (replaces_file_id, candidate_profile_id)
  where replaces_file_id is not null;

create index file_records_purpose_status_idx
  on public.file_records (purpose, status);

create index document_records_package_code_idx
  on public.document_records (package_code)
  where package_code is not null;

create index document_records_file_record_idx
  on public.document_records (file_record_id, candidate_profile_id)
  where file_record_id is not null;

create index document_records_privacy_mask_source_idx
  on public.document_records (
    privacy_mask_source_document_id,
    candidate_profile_id
  )
  where privacy_mask_source_document_id is not null;

create index document_records_category_status_idx
  on public.document_records (category, status);

commit;
