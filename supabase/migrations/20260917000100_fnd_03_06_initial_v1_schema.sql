begin;

-- Frozen V1 controlled values shared with the TypeScript data model.
create type public.relocation_preference as enum (
  'open',
  'not-open',
  'conditional',
  'not-specified'
);

create type public.target_market as enum (
  'indian-domestic',
  'gcc-middle-east',
  'european-union'
);

create type public.v1_package_code as enum (
  'indian-domestic',
  'gcc-middle-east',
  'europass-european-union',
  'domestic-gcc',
  'domestic-europass-european-union',
  'global-mobility-master',
  'executive-transition-agency-distribution'
);

create type public.resume_format_family as enum (
  'global-ats',
  'domestic',
  'gcc-middle-east',
  'europass-european-union'
);

create type public.language_proficiency as enum (
  'basic',
  'conversational',
  'professional-working',
  'fluent',
  'native-or-bilingual'
);

create type public.file_purpose as enum (
  'source-resume',
  'gcc-profile-photo'
);

create type public.file_upload_status as enum (
  'pending',
  'uploading',
  'available',
  'failed',
  'replaced'
);

create type public.file_access_level as enum ('private');

create type public.supported_file_mime_type as enum (
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
);

create type public.file_extension as enum (
  'doc',
  'docx',
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp'
);

create type public.document_category as enum (
  'source-resume',
  'resume',
  'cover-letter'
);

create type public.document_origin as enum ('uploaded', 'generated');

create type public.document_status as enum (
  'pending',
  'processing',
  'available',
  'failed',
  'archived'
);

create type public.cover_letter_type as enum (
  'general-corporate',
  'international-relocation',
  'technology-startup'
);

-- Package configuration is intentionally unseeded in FND-03-06.
create table public.package_definitions (
  code public.v1_package_code primary key,
  display_name text not null,
  target_markets public.target_market[] not null,
  resume_format_families public.resume_format_family[] not null,
  cover_letter_configuration_ref text,
  is_active boolean not null default true,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  primary_email text not null,
  mobile_number text not null,
  whatsapp_number text,
  linkedin_url text,
  current_location text not null,
  relocation_preference public.relocation_preference not null,
  selected_package_code public.v1_package_code not null,
  target_markets public.target_market[] not null,
  existing_resume_file_id uuid not null,
  gcc_photo_file_id uuid,
  professional_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.profile_work_experiences (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  employer_name text not null,
  job_title text not null,
  start_date text not null,
  current_role boolean not null default false,
  end_date text,
  location text,
  description text,
  highlights text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.profile_education_entries (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  institution_name text not null,
  qualification text not null,
  field_of_study text,
  start_date text,
  end_date text,
  location text,
  highlights text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.profile_certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  name text not null,
  issuing_organization text not null,
  issued_on text,
  expires_on text,
  credential_id text,
  credential_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.profile_languages (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  name text not null,
  proficiency public.language_proficiency,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.profile_projects (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  name text not null,
  role text,
  start_date text,
  end_date text,
  description text,
  highlights text[] not null default '{}'::text[],
  technologies text[] not null default '{}'::text[],
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.additional_profile_sections (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.additional_profile_section_items (
  id uuid primary key default gen_random_uuid(),
  additional_profile_section_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  heading text not null,
  subheading text,
  date_label text,
  description text,
  highlights text[] not null default '{}'::text[],
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.file_records (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  purpose public.file_purpose not null,
  original_file_name text not null,
  stored_file_name text,
  mime_type public.supported_file_mime_type not null,
  file_extension public.file_extension not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_bucket_name text,
  storage_object_key text,
  access_level public.file_access_level not null default 'private',
  status public.file_upload_status not null default 'pending',
  version_number integer not null default 1 check (version_number > 0),
  replaces_file_id uuid,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

create table public.document_records (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null,
  category public.document_category not null,
  origin public.document_origin not null,
  status public.document_status not null default 'pending',
  version_number integer not null default 1 check (version_number > 0),
  package_code public.v1_package_code,
  resume_format_family public.resume_format_family,
  cover_letter_type public.cover_letter_type,
  is_privacy_masked boolean not null default false,
  privacy_mask_source_document_id uuid,
  file_record_id uuid,
  file_name_stem text,
  file_extension public.file_extension,
  generated_at timestamptz,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  archived_by_user_id uuid,
  archive_reason text,
  administrative_note text
);

-- Foreign keys, relationship indexes, update triggers, cross-column lifecycle
-- checks, seed data, and access policies are intentionally deferred.

commit;
