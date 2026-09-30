import "server-only";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AdditionalProfileSection, CandidateProfile, CertificationEntry, EducationEntry,
  LanguageEntry, ProjectEntry, SkillEntry, WorkExperienceEntry,
} from "@/types/client-profile";

type OrderedRow = { id: string; sort_order: number };
type WorkRow = OrderedRow & { employer_name: string; job_title: string; start_date: string; end_date: string | null;
  is_current_role: boolean; location: string | null; description: string | null; highlights: string[] };
type EducationRow = OrderedRow & { institution_name: string; qualification: string; field_of_study: string | null;
  start_date: string | null; end_date: string | null; completion_year: number | null; location: string | null;
  grade_result: string | null; highlights: string[] };
type SkillRow = OrderedRow & { name: string; category: string | null };
type CertificationRow = OrderedRow & { name: string; issuing_organization: string; issued_on: string | null;
  issue_year: number | null; expires_on: string | null; expiry_year: number | null;
  credential_id: string | null; credential_url: string | null };
type LanguageRow = OrderedRow & { name: string; proficiency: LanguageEntry["proficiency"] | null };
type ProjectRow = OrderedRow & { name: string; role: string | null; start_date: string | null; end_date: string | null;
  description: string | null; highlights: string[]; technologies: string[]; url: string | null };
type SectionRow = OrderedRow & { title: string };
type SectionItemRow = OrderedRow & { additional_profile_section_id: string; heading: string; subheading: string | null;
  date_label: string | null; description: string | null; highlights: string[]; url: string | null };

const ordered = <T extends OrderedRow>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

/** Load one provisioned client's active canonical profile after checking admin access. */
export async function loadAdminCandidateProfile(userId: string): Promise<CandidateProfile | null> {
  await requireApplicationRole("admin");
  const db = createSupabaseAdminClient();
  const { data: role, error: roleError } = await db.from("user_roles")
    .select("candidate_profile_id").eq("user_id", userId).eq("role_code", "client").maybeSingle();
  if (roleError) throw new Error("Candidate linkage could not be loaded.");
  if (!role?.candidate_profile_id) return null;
  const profileId = role.candidate_profile_id;

  const [profileResult, workResult, educationResult, skillResult, certificationResult,
    languageResult, projectResult, sectionResult] = await Promise.all([
    db.from("candidate_profiles").select("id, full_name, primary_email, mobile_number, whatsapp_number, linkedin_url, current_location, relocation_preference, selected_package_code, target_markets, professional_summary, created_at, updated_at")
      .eq("id", profileId).is("archived_at", null).maybeSingle(),
    db.from("profile_work_experiences").select("id, sort_order, employer_name, job_title, start_date, end_date, is_current_role, location, description, highlights")
      .eq("candidate_profile_id", profileId).is("archived_at", null).order("sort_order").order("id"),
    db.from("profile_education_entries").select("id, sort_order, institution_name, qualification, field_of_study, start_date, end_date, completion_year, location, grade_result, highlights")
      .eq("candidate_profile_id", profileId).is("archived_at", null).order("sort_order").order("id"),
    db.from("profile_skills").select("id, sort_order, name, category")
      .eq("candidate_profile_id", profileId).is("archived_at", null).order("sort_order").order("id"),
    db.from("profile_certifications").select("id, sort_order, name, issuing_organization, issued_on, issue_year, expires_on, expiry_year, credential_id, credential_url")
      .eq("candidate_profile_id", profileId).is("archived_at", null).order("sort_order").order("id"),
    db.from("profile_languages").select("id, sort_order, name, proficiency")
      .eq("candidate_profile_id", profileId).is("archived_at", null).order("sort_order").order("id"),
    db.from("profile_projects").select("id, sort_order, name, role, start_date, end_date, description, highlights, technologies, url")
      .eq("candidate_profile_id", profileId).is("archived_at", null).order("sort_order").order("id"),
    db.from("additional_profile_sections").select("id, sort_order, title")
      .eq("candidate_profile_id", profileId).is("archived_at", null).order("sort_order").order("id"),
  ]);
  if ([profileResult, workResult, educationResult, skillResult, certificationResult,
    languageResult, projectResult, sectionResult].some((result) => result.error)) {
    throw new Error("Candidate profile could not be loaded.");
  }
  if (!profileResult.data) return null;

  const sections = ordered((sectionResult.data ?? []) as SectionRow[]);
  const { data: itemData, error: itemError } = sections.length
    ? await db.from("additional_profile_section_items")
        .select("id, additional_profile_section_id, sort_order, heading, subheading, date_label, description, highlights, url")
        .in("additional_profile_section_id", sections.map((section) => section.id))
        .is("archived_at", null).order("sort_order").order("id")
    : { data: [] as SectionItemRow[], error: null };
  if (itemError) throw new Error("Additional profile sections could not be loaded.");
  const items = ordered((itemData ?? []) as SectionItemRow[]);

  const profile = profileResult.data;
  return {
    id: profile.id, fullName: profile.full_name, primaryEmail: profile.primary_email,
    mobileNumber: profile.mobile_number, currentLocation: profile.current_location,
    relocationPreference: profile.relocation_preference as CandidateProfile["relocationPreference"],
    selectedPackage: profile.selected_package_code as CandidateProfile["selectedPackage"],
    targetMarkets: profile.target_markets as CandidateProfile["targetMarkets"],
    createdAt: profile.created_at, updatedAt: profile.updated_at,
    ...(profile.whatsapp_number ? { whatsappNumber: profile.whatsapp_number } : {}),
    ...(profile.linkedin_url ? { linkedinUrl: profile.linkedin_url } : {}),
    ...(profile.professional_summary ? { professionalSummary: profile.professional_summary } : {}),
    workExperience: ordered((workResult.data ?? []) as WorkRow[]).map((row): WorkExperienceEntry => ({
      id: row.id, sortOrder: row.sort_order, employerName: row.employer_name, jobTitle: row.job_title,
      startDate: row.start_date, currentRole: row.is_current_role, highlights: row.highlights,
      ...(row.end_date ? { endDate: row.end_date } : {}), ...(row.location ? { location: row.location } : {}),
      ...(row.description ? { description: row.description } : {}),
    })),
    education: ordered((educationResult.data ?? []) as EducationRow[]).map((row): EducationEntry => ({
      id: row.id, sortOrder: row.sort_order, institutionName: row.institution_name,
      qualification: row.qualification, highlights: row.highlights,
      ...(row.field_of_study ? { fieldOfStudy: row.field_of_study } : {}),
      ...(row.start_date ? { startDate: row.start_date } : {}), ...(row.end_date ? { endDate: row.end_date } : {}),
      ...(row.completion_year !== null ? { completionYear: row.completion_year } : {}),
      ...(row.location ? { location: row.location } : {}), ...(row.grade_result ? { gradeResult: row.grade_result } : {}),
    })),
    skills: ordered((skillResult.data ?? []) as SkillRow[]).map((row): SkillEntry => ({
      id: row.id, sortOrder: row.sort_order, name: row.name, ...(row.category ? { category: row.category } : {}),
    })),
    certifications: ordered((certificationResult.data ?? []) as CertificationRow[]).map((row): CertificationEntry => ({
      id: row.id, sortOrder: row.sort_order, name: row.name, issuingOrganization: row.issuing_organization,
      ...(row.issued_on ? { issuedOn: row.issued_on } : {}),
      ...(row.issue_year !== null ? { issueYear: row.issue_year } : {}),
      ...(row.expires_on ? { expiresOn: row.expires_on } : {}),
      ...(row.expiry_year !== null ? { expiryYear: row.expiry_year } : {}),
      ...(row.credential_id ? { credentialId: row.credential_id } : {}),
      ...(row.credential_url ? { credentialUrl: row.credential_url } : {}),
    })),
    languages: ordered((languageResult.data ?? []) as LanguageRow[]).map((row): LanguageEntry => ({
      id: row.id, sortOrder: row.sort_order, name: row.name,
      ...(row.proficiency ? { proficiency: row.proficiency } : {}),
    })),
    projects: ordered((projectResult.data ?? []) as ProjectRow[]).map((row): ProjectEntry => ({
      id: row.id, sortOrder: row.sort_order, name: row.name, highlights: row.highlights,
      technologies: row.technologies, ...(row.role ? { role: row.role } : {}),
      ...(row.start_date ? { startDate: row.start_date } : {}), ...(row.end_date ? { endDate: row.end_date } : {}),
      ...(row.description ? { description: row.description } : {}), ...(row.url ? { url: row.url } : {}),
    })),
    additionalSections: sections.map((row): AdditionalProfileSection => ({
      id: row.id, sortOrder: row.sort_order, title: row.title,
      items: items.filter((item) => item.additional_profile_section_id === row.id).map((item) => ({
        id: item.id, sortOrder: item.sort_order, heading: item.heading, highlights: item.highlights,
        ...(item.subheading ? { subheading: item.subheading } : {}),
        ...(item.date_label ? { dateLabel: item.date_label } : {}),
        ...(item.description ? { description: item.description } : {}),
        ...(item.url ? { url: item.url } : {}),
      })),
    })),
  };
}
