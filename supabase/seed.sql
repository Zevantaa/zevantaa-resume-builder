-- FND-03-08: fictional development/test data only.
-- No names, contact details, employers, files, buckets, or object keys below
-- represent real people, organizations, or stored objects.

begin;

-- Candidate profiles must be inserted before their owned file records, while
-- each profile also references its source file. These two foreign keys are
-- deferrable, so validate the completed graph immediately before commit.
set constraints all deferred;

insert into public.package_definitions (
  code,
  display_name,
  target_markets,
  resume_format_families,
  cover_letter_configuration_ref,
  is_active,
  sort_order,
  created_at,
  updated_at,
  administrative_note
)
values
  (
    'indian-domestic',
    'Indian Domestic',
    array['indian-domestic']::public.target_market[],
    array['global-ats', 'domestic']::public.resume_format_family[],
    null,
    true,
    1,
    timestamptz '2026-01-01 09:00:00+00',
    timestamptz '2026-01-01 09:00:00+00',
    'FND-03-08 fictional test seed.'
  ),
  (
    'gcc-middle-east',
    'GCC / Middle East',
    array['gcc-middle-east']::public.target_market[],
    array['global-ats', 'gcc-middle-east']::public.resume_format_family[],
    null,
    true,
    2,
    timestamptz '2026-01-01 09:00:00+00',
    timestamptz '2026-01-01 09:00:00+00',
    'FND-03-08 fictional test seed.'
  ),
  (
    'europass-european-union',
    'Europass / EU',
    array['european-union']::public.target_market[],
    array['global-ats', 'europass-european-union']::public.resume_format_family[],
    null,
    true,
    3,
    timestamptz '2026-01-01 09:00:00+00',
    timestamptz '2026-01-01 09:00:00+00',
    'FND-03-08 fictional test seed.'
  ),
  (
    'domestic-gcc',
    'Domestic + GCC',
    array['indian-domestic', 'gcc-middle-east']::public.target_market[],
    array['global-ats', 'domestic', 'gcc-middle-east']::public.resume_format_family[],
    null,
    true,
    4,
    timestamptz '2026-01-01 09:00:00+00',
    timestamptz '2026-01-01 09:00:00+00',
    'FND-03-08 fictional test seed.'
  ),
  (
    'domestic-europass-european-union',
    'Domestic + Europass / EU',
    array['indian-domestic', 'european-union']::public.target_market[],
    array[
      'global-ats',
      'domestic',
      'europass-european-union'
    ]::public.resume_format_family[],
    null,
    true,
    5,
    timestamptz '2026-01-01 09:00:00+00',
    timestamptz '2026-01-01 09:00:00+00',
    'FND-03-08 fictional test seed.'
  ),
  (
    'global-mobility-master',
    'Domestic + GCC + Europass',
    array[
      'indian-domestic',
      'gcc-middle-east',
      'european-union'
    ]::public.target_market[],
    array[
      'global-ats',
      'domestic',
      'gcc-middle-east',
      'europass-european-union'
    ]::public.resume_format_family[],
    null,
    true,
    6,
    timestamptz '2026-01-01 09:00:00+00',
    timestamptz '2026-01-01 09:00:00+00',
    'FND-03-08 fictional test seed.'
  ),
  (
    'executive-transition-agency-distribution',
    'Executive All-Inclusive',
    array[
      'indian-domestic',
      'gcc-middle-east',
      'european-union'
    ]::public.target_market[],
    array[
      'global-ats',
      'domestic',
      'gcc-middle-east',
      'europass-european-union'
    ]::public.resume_format_family[],
    null,
    true,
    7,
    timestamptz '2026-01-01 09:00:00+00',
    timestamptz '2026-01-01 09:00:00+00',
    'FND-03-08 fictional test seed.'
  )
on conflict do nothing;

insert into public.candidate_profiles (
  id,
  full_name,
  primary_email,
  mobile_number,
  whatsapp_number,
  linkedin_url,
  current_location,
  relocation_preference,
  selected_package_code,
  target_markets,
  existing_resume_file_id,
  gcc_photo_file_id,
  professional_summary,
  created_at,
  updated_at,
  administrative_note
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Aanya Test-Mehta',
    'aanya.mehta@india.example',
    '+91-00000-00001',
    '+91-00000-00002',
    'https://example.invalid/linkedin/aanya-test-mehta',
    'Pune, India',
    'open',
    'indian-domestic',
    array['indian-domestic']::public.target_market[],
    '20000000-0000-4000-8000-000000000001',
    null,
    'Fictional operations analyst focused on measurable process improvements.',
    timestamptz '2026-01-10 09:00:00+00',
    timestamptz '2026-01-10 09:00:00+00',
    'FND-03-08 fictional India-focused candidate.'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Omar Example-Rahman',
    'omar.rahman@gcc.example',
    '+971-50-000-0001',
    '+971-50-000-0002',
    'https://example.invalid/linkedin/omar-example-rahman',
    'Dubai, United Arab Emirates',
    'conditional',
    'gcc-middle-east',
    array['gcc-middle-east']::public.target_market[],
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'Fictional facilities coordinator experienced in multi-site GCC operations.',
    timestamptz '2026-01-11 09:00:00+00',
    timestamptz '2026-01-11 09:00:00+00',
    'FND-03-08 fictional GCC-focused candidate.'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Elena Sample-Novak',
    'elena.novak@eu.example',
    '+49-000-000001',
    null,
    'https://example.invalid/linkedin/elena-sample-novak',
    'Berlin, Germany',
    'not-open',
    'europass-european-union',
    array['european-union']::public.target_market[],
    '20000000-0000-4000-8000-000000000005',
    null,
    'Fictional data specialist supporting multilingual European programmes.',
    timestamptz '2026-01-12 09:00:00+00',
    timestamptz '2026-01-12 09:00:00+00',
    'FND-03-08 fictional EU-focused candidate.'
  )
on conflict do nothing;

-- Synthetic metadata only. The bucket and object keys intentionally do not
-- create or imply any real storage objects.
insert into public.file_records (
  id,
  candidate_profile_id,
  purpose,
  original_file_name,
  stored_file_name,
  mime_type,
  file_extension,
  size_bytes,
  storage_bucket_name,
  storage_object_key,
  access_level,
  status,
  version_number,
  replaces_file_id,
  uploaded_at,
  created_at,
  updated_at,
  administrative_note
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'source-resume',
    'aanya-test-resume.pdf',
    'seed-aanya-resume-v1.pdf',
    'application/pdf',
    'pdf',
    148250,
    'test-private-candidate-files',
    'seed-only/candidates/aanya/source-resume-v1.pdf',
    'private',
    'available',
    1,
    null,
    timestamptz '2026-01-10 09:05:00+00',
    timestamptz '2026-01-10 09:05:00+00',
    timestamptz '2026-01-10 09:05:00+00',
    'Synthetic source-resume metadata; no object exists.'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'source-resume',
    'omar-example-resume.docx',
    'seed-omar-resume-v1.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx',
    93240,
    'test-private-candidate-files',
    'seed-only/candidates/omar/source-resume-v1.docx',
    'private',
    'available',
    1,
    null,
    timestamptz '2026-01-11 09:05:00+00',
    timestamptz '2026-01-11 09:05:00+00',
    timestamptz '2026-01-11 09:05:00+00',
    'Synthetic source-resume metadata; no object exists.'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'gcc-profile-photo',
    'omar-example-photo.jpg',
    'seed-omar-photo-v1.jpg',
    'image/jpeg',
    'jpg',
    48210,
    'test-private-candidate-files',
    'seed-only/candidates/omar/gcc-photo-v1.jpg',
    'private',
    'available',
    1,
    null,
    timestamptz '2026-01-11 09:06:00+00',
    timestamptz '2026-01-11 09:06:00+00',
    timestamptz '2026-01-11 09:06:00+00',
    'Synthetic GCC photo metadata; no object exists.'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000003',
    'source-resume',
    'elena-sample-resume-v1.doc',
    'seed-elena-resume-v1.doc',
    'application/msword',
    'doc',
    78600,
    'test-private-candidate-files',
    'seed-only/candidates/elena/source-resume-v1.doc',
    'private',
    'replaced',
    1,
    null,
    timestamptz '2026-01-12 09:05:00+00',
    timestamptz '2026-01-12 09:05:00+00',
    timestamptz '2026-01-12 09:10:00+00',
    'Synthetic replaced source-resume metadata; no object exists.'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000003',
    'source-resume',
    'elena-sample-resume-v2.pdf',
    'seed-elena-resume-v2.pdf',
    'application/pdf',
    'pdf',
    164320,
    'test-private-candidate-files',
    'seed-only/candidates/elena/source-resume-v2.pdf',
    'private',
    'available',
    2,
    '20000000-0000-4000-8000-000000000004',
    timestamptz '2026-01-12 09:10:00+00',
    timestamptz '2026-01-12 09:10:00+00',
    timestamptz '2026-01-12 09:10:00+00',
    'Synthetic replacement source-resume metadata; no object exists.'
  )
on conflict do nothing;

insert into public.profile_work_experiences (
  id,
  candidate_profile_id,
  sort_order,
  employer_name,
  job_title,
  start_date,
  is_current_role,
  end_date,
  location,
  description,
  highlights,
  created_at,
  updated_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    0,
    'Fictional Meridian Systems Pvt Ltd',
    'Senior Operations Analyst',
    '2022-04',
    true,
    null,
    'Pune, India',
    'Coordinates fictional service-delivery reporting and process reviews.',
    array[
      'Reduced a simulated monthly reporting cycle from five days to three.',
      'Documented fictional controls for four operational teams.'
    ],
    timestamptz '2026-01-10 09:00:00+00',
    timestamptz '2026-01-10 09:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    1,
    'Imaginary Blue Kite Services Ltd',
    'Operations Coordinator',
    '2019-06',
    false,
    '2022-03',
    'Mumbai, India',
    'Supported fictional scheduling, vendor coordination, and reporting.',
    array['Maintained a simulated 98 percent schedule-compliance rate.'],
    timestamptz '2026-01-10 09:00:00+00',
    timestamptz '2026-01-10 09:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    0,
    'Imaginary Gulf Operations FZ-LLC',
    'Facilities Coordinator',
    '2021-09',
    true,
    null,
    'Dubai, United Arab Emirates',
    'Coordinates fictional maintenance schedules across regional sites.',
    array[
      'Tracked simulated service requests across six facilities.',
      'Introduced a fictional preventive-maintenance dashboard.'
    ],
    timestamptz '2026-01-11 09:00:00+00',
    timestamptz '2026-01-11 09:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    1,
    'Fictional Desert Harbour Services LLC',
    'Site Administrator',
    '2018-02',
    false,
    '2021-08',
    'Abu Dhabi, United Arab Emirates',
    'Maintained fictional contractor and compliance records.',
    array['Prepared simulated audit packs with no overdue actions.'],
    timestamptz '2026-01-11 09:00:00+00',
    timestamptz '2026-01-11 09:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000003',
    0,
    'Example Europa Analytics GmbH',
    'Data Programme Specialist',
    '2023-01',
    true,
    null,
    'Berlin, Germany',
    'Supports fictional cross-border reporting and data-quality initiatives.',
    array[
      'Standardized a simulated reporting catalogue across five countries.',
      'Raised fictional validation coverage from 72 to 94 percent.'
    ],
    timestamptz '2026-01-12 09:00:00+00',
    timestamptz '2026-01-12 09:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000003',
    1,
    'Fictional Northstar Research Sp z oo',
    'Junior Data Coordinator',
    '2020-05',
    false,
    '2022-12',
    'Warsaw, Poland',
    'Prepared fictional multilingual datasets and status reports.',
    array['Consolidated 12 simulated project trackers into one reporting view.'],
    timestamptz '2026-01-12 09:00:00+00',
    timestamptz '2026-01-12 09:00:00+00'
  )
on conflict do nothing;

insert into public.profile_education_entries (
  id,
  candidate_profile_id,
  sort_order,
  institution_name,
  qualification,
  field_of_study,
  start_date,
  end_date,
  location,
  highlights,
  created_at,
  updated_at
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    0,
    'Fictional Western Institute of Management',
    'Master of Business Administration',
    'Operations Management',
    '2017-07',
    '2019-05',
    'Pune, India',
    array['Completed a fictional capstone on service-process measurement.'],
    timestamptz '2026-01-10 09:00:00+00',
    timestamptz '2026-01-10 09:00:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    0,
    'Imaginary Gulf Technical College',
    'Bachelor of Business Administration',
    'Facilities and Operations',
    '2013-09',
    '2017-06',
    'Sharjah, United Arab Emirates',
    array['Led a fictional final-year workplace-safety project.'],
    timestamptz '2026-01-11 09:00:00+00',
    timestamptz '2026-01-11 09:00:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    0,
    'Example European School of Applied Data',
    'Master of Science',
    'Information Systems',
    '2018-10',
    '2020-04',
    'Prague, Czechia',
    array['Produced a fictional thesis on multilingual data quality.'],
    timestamptz '2026-01-12 09:00:00+00',
    timestamptz '2026-01-12 09:00:00+00'
  )
on conflict do nothing;

insert into public.profile_skills (
  id,
  candidate_profile_id,
  sort_order,
  name,
  category,
  created_at,
  updated_at
)
values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 0, 'Process mapping', 'Operations', timestamptz '2026-01-10 09:00:00+00', timestamptz '2026-01-10 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 1, 'Management reporting', 'Analytics', timestamptz '2026-01-10 09:00:00+00', timestamptz '2026-01-10 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 2, 'Stakeholder coordination', 'Delivery', timestamptz '2026-01-10 09:00:00+00', timestamptz '2026-01-10 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 0, 'Facilities coordination', 'Operations', timestamptz '2026-01-11 09:00:00+00', timestamptz '2026-01-11 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 1, 'Vendor management', 'Commercial', timestamptz '2026-01-11 09:00:00+00', timestamptz '2026-01-11 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 2, 'Preventive maintenance planning', 'Facilities', timestamptz '2026-01-11 09:00:00+00', timestamptz '2026-01-11 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 0, 'Data quality management', 'Data', timestamptz '2026-01-12 09:00:00+00', timestamptz '2026-01-12 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000003', 1, 'Programme reporting', 'Delivery', timestamptz '2026-01-12 09:00:00+00', timestamptz '2026-01-12 09:00:00+00'),
  ('60000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003', 2, 'Requirements analysis', 'Analysis', timestamptz '2026-01-12 09:00:00+00', timestamptz '2026-01-12 09:00:00+00')
on conflict do nothing;

insert into public.profile_certifications (
  id,
  candidate_profile_id,
  sort_order,
  name,
  issuing_organization,
  issued_on,
  expires_on,
  credential_id,
  credential_url,
  created_at,
  updated_at
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    0,
    'Fictional Lean Operations Certificate',
    'Example Process Institute',
    '2024-03',
    null,
    'TEST-IND-001',
    'https://example.invalid/credentials/test-ind-001',
    timestamptz '2026-01-10 09:00:00+00',
    timestamptz '2026-01-10 09:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    0,
    'Fictional Facilities Safety Certificate',
    'Imaginary Regional Safety Council',
    '2025-02',
    '2027-02',
    'TEST-GCC-002',
    'https://example.invalid/credentials/test-gcc-002',
    timestamptz '2026-01-11 09:00:00+00',
    timestamptz '2026-01-11 09:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    0,
    'Fictional European Data Quality Certificate',
    'Example Data Standards Academy',
    '2024-11',
    null,
    'TEST-EU-003',
    'https://example.invalid/credentials/test-eu-003',
    timestamptz '2026-01-12 09:00:00+00',
    timestamptz '2026-01-12 09:00:00+00'
  )
on conflict do nothing;

insert into public.profile_languages (
  id,
  candidate_profile_id,
  sort_order,
  name,
  proficiency,
  created_at,
  updated_at
)
values
  ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 0, 'English', 'fluent', timestamptz '2026-01-10 09:00:00+00', timestamptz '2026-01-10 09:00:00+00'),
  ('80000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 1, 'Hindi', 'native-or-bilingual', timestamptz '2026-01-10 09:00:00+00', timestamptz '2026-01-10 09:00:00+00'),
  ('80000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 0, 'English', 'fluent', timestamptz '2026-01-11 09:00:00+00', timestamptz '2026-01-11 09:00:00+00'),
  ('80000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 1, 'Arabic', 'professional-working', timestamptz '2026-01-11 09:00:00+00', timestamptz '2026-01-11 09:00:00+00'),
  ('80000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 0, 'English', 'fluent', timestamptz '2026-01-12 09:00:00+00', timestamptz '2026-01-12 09:00:00+00'),
  ('80000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 1, 'German', 'professional-working', timestamptz '2026-01-12 09:00:00+00', timestamptz '2026-01-12 09:00:00+00'),
  ('80000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 2, 'Polish', 'native-or-bilingual', timestamptz '2026-01-12 09:00:00+00', timestamptz '2026-01-12 09:00:00+00')
on conflict do nothing;

insert into public.profile_projects (
  id,
  candidate_profile_id,
  sort_order,
  name,
  role,
  start_date,
  end_date,
  description,
  highlights,
  technologies,
  url,
  created_at,
  updated_at
)
values
  (
    '90000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    0,
    'Fictional Service Metrics Refresh',
    'Project Lead',
    '2024-01',
    '2024-06',
    'Designed a fictional operational scorecard for test content.',
    array['Defined 14 simulated measures and review checkpoints.'],
    array['Spreadsheet modelling', 'Process mapping'],
    'https://example.invalid/projects/service-metrics-refresh',
    timestamptz '2026-01-10 09:00:00+00',
    timestamptz '2026-01-10 09:00:00+00'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    0,
    'Imaginary Multi-Site Maintenance Rollout',
    'Regional Coordinator',
    '2023-05',
    '2023-12',
    'Coordinated a fictional maintenance-planning pilot.',
    array['Created a simulated rollout plan covering six sites.'],
    array['Work-order tracking', 'Vendor coordination'],
    'https://example.invalid/projects/gcc-maintenance-rollout',
    timestamptz '2026-01-11 09:00:00+00',
    timestamptz '2026-01-11 09:00:00+00'
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    0,
    'Example Cross-Border Data Catalogue',
    'Data Workstream Lead',
    '2024-02',
    '2024-10',
    'Built a fictional catalogue for multilingual programme reporting.',
    array['Mapped 85 simulated fields across five market datasets.'],
    array['SQL', 'Data cataloguing', 'Validation rules'],
    'https://example.invalid/projects/eu-data-catalogue',
    timestamptz '2026-01-12 09:00:00+00',
    timestamptz '2026-01-12 09:00:00+00'
  )
on conflict do nothing;

insert into public.additional_profile_sections (
  id,
  candidate_profile_id,
  sort_order,
  title,
  created_at,
  updated_at
)
values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 0, 'Volunteer Experience', timestamptz '2026-01-10 09:00:00+00', timestamptz '2026-01-10 09:00:00+00'),
  ('a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 0, 'Professional Memberships', timestamptz '2026-01-11 09:00:00+00', timestamptz '2026-01-11 09:00:00+00'),
  ('a0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 0, 'Conference Contributions', timestamptz '2026-01-12 09:00:00+00', timestamptz '2026-01-12 09:00:00+00')
on conflict do nothing;

insert into public.additional_profile_section_items (
  id,
  additional_profile_section_id,
  sort_order,
  heading,
  subheading,
  date_label,
  description,
  highlights,
  url,
  created_at,
  updated_at
)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    0,
    'Fictional Community Skills Workshop',
    'Volunteer Facilitator',
    '2024',
    'Delivered simulated employability workshops for test resume content.',
    array['Prepared four fictional workshop modules.'],
    'https://example.invalid/additional/community-workshop',
    timestamptz '2026-01-10 09:00:00+00',
    timestamptz '2026-01-10 09:00:00+00'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    0,
    'Imaginary Facilities Network',
    'Test Member',
    '2023-present',
    'Fictional membership included solely to exercise additional sections.',
    array['Participated in three simulated regional roundtables.'],
    'https://example.invalid/additional/facilities-network',
    timestamptz '2026-01-11 09:00:00+00',
    timestamptz '2026-01-11 09:00:00+00'
  ),
  (
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000003',
    0,
    'Example Data Quality Forum',
    'Fictional Panel Contributor',
    '2025',
    'Discussed a simulated multilingual validation programme.',
    array['Presented a fictional case study to 60 test attendees.'],
    'https://example.invalid/additional/data-quality-forum',
    timestamptz '2026-01-12 09:00:00+00',
    timestamptz '2026-01-12 09:00:00+00'
  )
on conflict do nothing;

-- Source documents are available because their synthetic file metadata exists.
insert into public.document_records (
  id,
  candidate_profile_id,
  category,
  origin,
  status,
  version_number,
  package_code,
  resume_format_family,
  cover_letter_type,
  is_privacy_masked,
  privacy_mask_source_document_id,
  file_record_id,
  file_name_stem,
  file_extension,
  generated_at,
  exported_at,
  created_at,
  updated_at,
  administrative_note
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'source-resume',
    'uploaded',
    'available',
    1,
    'indian-domestic',
    null,
    null,
    false,
    null,
    '20000000-0000-4000-8000-000000000001',
    'aanya-test-source-resume',
    'pdf',
    null,
    null,
    timestamptz '2026-01-10 09:07:00+00',
    timestamptz '2026-01-10 09:07:00+00',
    'Fictional source document record.'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'source-resume',
    'uploaded',
    'available',
    1,
    'gcc-middle-east',
    null,
    null,
    false,
    null,
    '20000000-0000-4000-8000-000000000002',
    'omar-example-source-resume',
    'docx',
    null,
    null,
    timestamptz '2026-01-11 09:07:00+00',
    timestamptz '2026-01-11 09:07:00+00',
    'Fictional source document record.'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'source-resume',
    'uploaded',
    'available',
    2,
    'europass-european-union',
    null,
    null,
    false,
    null,
    '20000000-0000-4000-8000-000000000005',
    'elena-sample-source-resume-v2',
    'pdf',
    null,
    null,
    timestamptz '2026-01-12 09:12:00+00',
    timestamptz '2026-01-12 09:12:00+00',
    'Fictional replacement source document record.'
  )
on conflict do nothing;

-- Generated outputs remain pending/processing because no real generation or
-- storage objects exist. Their required naming and package metadata is present.
insert into public.document_records (
  id,
  candidate_profile_id,
  category,
  origin,
  status,
  version_number,
  package_code,
  resume_format_family,
  cover_letter_type,
  is_privacy_masked,
  privacy_mask_source_document_id,
  file_record_id,
  file_name_stem,
  file_extension,
  generated_at,
  exported_at,
  created_at,
  updated_at,
  administrative_note
)
values
  (
    '30000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    'resume',
    'generated',
    'processing',
    1,
    'indian-domestic',
    'domestic',
    null,
    false,
    null,
    null,
    'aanya-test-domestic-resume-v1',
    'pdf',
    null,
    null,
    timestamptz '2026-01-10 09:15:00+00',
    timestamptz '2026-01-10 09:15:00+00',
    'Fictional generated-resume workflow record; no output file exists.'
  ),
  (
    '30000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000002',
    'resume',
    'generated',
    'processing',
    1,
    'gcc-middle-east',
    'gcc-middle-east',
    null,
    false,
    null,
    null,
    'omar-example-gcc-resume-v1',
    'pdf',
    null,
    null,
    timestamptz '2026-01-11 09:15:00+00',
    timestamptz '2026-01-11 09:15:00+00',
    'Fictional generated-resume workflow record; no output file exists.'
  ),
  (
    '30000000-0000-4000-8000-000000000013',
    '10000000-0000-4000-8000-000000000003',
    'resume',
    'generated',
    'processing',
    1,
    'europass-european-union',
    'europass-european-union',
    null,
    false,
    null,
    null,
    'elena-sample-europass-resume-v1',
    'pdf',
    null,
    null,
    timestamptz '2026-01-12 09:15:00+00',
    timestamptz '2026-01-12 09:15:00+00',
    'Fictional generated-resume workflow record; no output file exists.'
  ),
  (
    '30000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000001',
    'cover-letter',
    'generated',
    'pending',
    1,
    'indian-domestic',
    null,
    'general-corporate',
    false,
    null,
    null,
    'aanya-test-general-cover-letter-v1',
    'pdf',
    null,
    null,
    timestamptz '2026-01-10 09:16:00+00',
    timestamptz '2026-01-10 09:16:00+00',
    'Fictional cover-letter workflow record; no output file exists.'
  ),
  (
    '30000000-0000-4000-8000-000000000022',
    '10000000-0000-4000-8000-000000000002',
    'cover-letter',
    'generated',
    'pending',
    1,
    'gcc-middle-east',
    null,
    'international-relocation',
    false,
    null,
    null,
    'omar-example-relocation-cover-letter-v1',
    'pdf',
    null,
    null,
    timestamptz '2026-01-11 09:16:00+00',
    timestamptz '2026-01-11 09:16:00+00',
    'Fictional cover-letter workflow record; no output file exists.'
  ),
  (
    '30000000-0000-4000-8000-000000000023',
    '10000000-0000-4000-8000-000000000003',
    'cover-letter',
    'generated',
    'pending',
    1,
    'europass-european-union',
    null,
    'technology-startup',
    false,
    null,
    null,
    'elena-sample-technology-cover-letter-v1',
    'pdf',
    null,
    null,
    timestamptz '2026-01-12 09:16:00+00',
    timestamptz '2026-01-12 09:16:00+00',
    'Fictional cover-letter workflow record; no output file exists.'
  )
on conflict do nothing;

-- Separate privacy-masked output referencing the unmasked GCC resume record.
insert into public.document_records (
  id,
  candidate_profile_id,
  category,
  origin,
  status,
  version_number,
  package_code,
  resume_format_family,
  cover_letter_type,
  is_privacy_masked,
  privacy_mask_source_document_id,
  file_record_id,
  file_name_stem,
  file_extension,
  generated_at,
  exported_at,
  created_at,
  updated_at,
  administrative_note
)
values (
  '30000000-0000-4000-8000-000000000031',
  '10000000-0000-4000-8000-000000000002',
  'resume',
  'generated',
  'processing',
  1,
  'gcc-middle-east',
  'gcc-middle-east',
  null,
  true,
  '30000000-0000-4000-8000-000000000012',
  null,
  'omar-example-gcc-resume-masked-v1',
  'pdf',
  null,
  null,
  timestamptz '2026-01-11 09:17:00+00',
  timestamptz '2026-01-11 09:17:00+00',
  'Fictional privacy-mask workflow record; no output file exists.'
)
on conflict do nothing;

set constraints all immediate;

commit;
