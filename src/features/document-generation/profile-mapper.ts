import type {
  AdditionalProfileSection, CandidateProfile, CertificationEntry,
  EducationEntry, LanguageEntry, OrderedProfileItem, ProjectEntry,
  SkillEntry, WorkExperienceEntry,
} from "@/types/client-profile";
import type { EntityId, IsoDateTime } from "@/types/core";
import type { DocumentCategory } from "@/types/document-record";

/** Transient, layout-neutral projection; never a second persisted profile. */
export interface DocumentData {
  sourceProfileId: EntityId;
  sourceUpdatedAt: IsoDateTime;
  identity: {
    fullName: string;
    primaryEmail?: string;
    mobileNumber?: string;
    whatsappNumber?: string;
    linkedinUrl?: string;
    currentLocation?: string;
    relocationPreference: CandidateProfile["relocationPreference"];
  };
  professionalSummary?: { text: string; source: "candidate-supplied" };
  employment?: WorkExperienceEntry[];
  education?: EducationEntry[];
  skills?: SkillEntry[];
  certifications?: CertificationEntry[];
  languages?: LanguageEntry[];
  projects?: ProjectEntry[];
  additionalSections?: AdditionalProfileSection[];
  packageContext: {
    selectedPackage: CandidateProfile["selectedPackage"];
    targetMarkets: CandidateProfile["targetMarkets"];
  };
  /** Private file ID only; a later server-side renderer must resolve access. */
  gccPhotoFileId?: EntityId;
}

export type DocumentDataPurpose = Exclude<DocumentCategory, "source-resume">;
export type DocumentDataFindingCode =
  | "missing_full_name" | "missing_primary_email" | "missing_mobile_number"
  | "missing_package" | "missing_target_market" | "missing_resume_content"
  | "missing_cover_letter_context" | "incomplete_section_item" | "inconsistent_current_role";

export interface DocumentDataFinding {
  code: DocumentDataFindingCode;
  severity: "warning" | "error";
  path: string;
  message: string;
}

export interface DocumentDataMappingResult {
  data: DocumentData;
  findings: DocumentDataFinding[];
  canGenerate: boolean;
}

const hasText = (value: string | undefined | null): value is string =>
  typeof value === "string" && value.trim().length > 0;
const bullets = (values: readonly string[] | undefined): string[] =>
  (values ?? []).filter(hasText);
const ordered = <T extends OrderedProfileItem>(items: readonly T[] | undefined): T[] =>
  [...(items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

/** Map reviewed canonical facts only; never insert default claims or prose. */
export function mapCandidateProfileToDocumentData(
  profile: CandidateProfile,
  purpose: DocumentDataPurpose,
): DocumentDataMappingResult {
  const findings: DocumentDataFinding[] = [];
  const finding = (code: DocumentDataFindingCode, severity: DocumentDataFinding["severity"], path: string, message: string) =>
    findings.push({ code, severity, path, message });
  const incomplete = (path: string) =>
    finding("incomplete_section_item", "warning", path, "An incomplete item was omitted; review the stored candidate data.");

  const employment = ordered(profile.workExperience).flatMap((item): WorkExperienceEntry[] => {
    if (!hasText(item.employerName) || !hasText(item.jobTitle) || !hasText(item.startDate)) {
      incomplete(`workExperience.${item.id}`);
      return [];
    }
    if (item.currentRole && hasText(item.endDate)) {
      finding("inconsistent_current_role", "warning", `workExperience.${item.id}.endDate`, "A current role had an end date; the date was omitted.");
    }
    return [{
      id: item.id, sortOrder: item.sortOrder, employerName: item.employerName,
      jobTitle: item.jobTitle, startDate: item.startDate, currentRole: item.currentRole,
      ...(!item.currentRole && hasText(item.endDate) ? { endDate: item.endDate } : {}),
      ...(hasText(item.location) ? { location: item.location } : {}),
      ...(hasText(item.description) ? { description: item.description } : {}),
      highlights: bullets(item.highlights),
    }];
  });
  const education = ordered(profile.education).flatMap((item): EducationEntry[] => {
    if (!hasText(item.institutionName) || !hasText(item.qualification)) {
      incomplete(`education.${item.id}`);
      return [];
    }
    return [{
      id: item.id, sortOrder: item.sortOrder, institutionName: item.institutionName,
      qualification: item.qualification,
      ...(hasText(item.fieldOfStudy) ? { fieldOfStudy: item.fieldOfStudy } : {}),
      ...(hasText(item.startDate) ? { startDate: item.startDate } : {}),
      ...(hasText(item.endDate) ? { endDate: item.endDate } : {}),
      ...(item.completionYear !== undefined ? { completionYear: item.completionYear } : {}),
      ...(hasText(item.location) ? { location: item.location } : {}),
      ...(hasText(item.gradeResult) ? { gradeResult: item.gradeResult } : {}),
      highlights: bullets(item.highlights),
    }];
  });
  const skills = ordered(profile.skills).flatMap((item): SkillEntry[] => {
    if (!hasText(item.name)) { incomplete(`skills.${item.id}`); return []; }
    return [{ id: item.id, sortOrder: item.sortOrder, name: item.name,
      ...(hasText(item.category) ? { category: item.category } : {}) }];
  });
  const certifications = ordered(profile.certifications).flatMap((item): CertificationEntry[] => {
    if (!hasText(item.name) || !hasText(item.issuingOrganization)) {
      incomplete(`certifications.${item.id}`);
      return [];
    }
    return [{
      id: item.id, sortOrder: item.sortOrder, name: item.name,
      issuingOrganization: item.issuingOrganization,
      ...(hasText(item.issuedOn) ? { issuedOn: item.issuedOn } : {}),
      ...(item.issueYear !== undefined ? { issueYear: item.issueYear } : {}),
      ...(hasText(item.expiresOn) ? { expiresOn: item.expiresOn } : {}),
      ...(item.expiryYear !== undefined ? { expiryYear: item.expiryYear } : {}),
      ...(hasText(item.credentialId) ? { credentialId: item.credentialId } : {}),
      ...(hasText(item.credentialUrl) ? { credentialUrl: item.credentialUrl } : {}),
    }];
  });
  const languages = ordered(profile.languages).flatMap((item): LanguageEntry[] => {
    if (!hasText(item.name)) { incomplete(`languages.${item.id}`); return []; }
    return [{ id: item.id, sortOrder: item.sortOrder, name: item.name,
      ...(item.proficiency ? { proficiency: item.proficiency } : {}) }];
  });
  const projects = ordered(profile.projects).flatMap((item): ProjectEntry[] => {
    if (!hasText(item.name)) { incomplete(`projects.${item.id}`); return []; }
    return [{
      id: item.id, sortOrder: item.sortOrder, name: item.name,
      ...(hasText(item.role) ? { role: item.role } : {}),
      ...(hasText(item.startDate) ? { startDate: item.startDate } : {}),
      ...(hasText(item.endDate) ? { endDate: item.endDate } : {}),
      ...(hasText(item.description) ? { description: item.description } : {}),
      highlights: bullets(item.highlights), technologies: bullets(item.technologies),
      ...(hasText(item.url) ? { url: item.url } : {}),
    }];
  });
  const additionalSections = ordered(profile.additionalSections).flatMap((section): AdditionalProfileSection[] => {
    const items = ordered(section.items).flatMap((item) => {
      if (!hasText(item.heading)) {
        incomplete(`additionalSections.${section.id}.items.${item.id}`);
        return [];
      }
      return [{
        id: item.id, sortOrder: item.sortOrder, heading: item.heading,
        ...(hasText(item.subheading) ? { subheading: item.subheading } : {}),
        ...(hasText(item.dateLabel) ? { dateLabel: item.dateLabel } : {}),
        ...(hasText(item.description) ? { description: item.description } : {}),
        highlights: bullets(item.highlights),
        ...(hasText(item.url) ? { url: item.url } : {}),
      }];
    });
    if (!hasText(section.title) || items.length === 0) {
      incomplete(`additionalSections.${section.id}`);
      return [];
    }
    return [{ id: section.id, sortOrder: section.sortOrder, title: section.title, items }];
  });

  const data: DocumentData = {
    sourceProfileId: profile.id, sourceUpdatedAt: profile.updatedAt,
    identity: {
      fullName: profile.fullName,
      ...(hasText(profile.primaryEmail) ? { primaryEmail: profile.primaryEmail } : {}),
      ...(hasText(profile.mobileNumber) ? { mobileNumber: profile.mobileNumber } : {}),
      ...(hasText(profile.whatsappNumber) ? { whatsappNumber: profile.whatsappNumber } : {}),
      ...(hasText(profile.linkedinUrl) ? { linkedinUrl: profile.linkedinUrl } : {}),
      ...(hasText(profile.currentLocation) ? { currentLocation: profile.currentLocation } : {}),
      relocationPreference: profile.relocationPreference,
    },
    ...(hasText(profile.professionalSummary) ? {
      professionalSummary: { text: profile.professionalSummary, source: "candidate-supplied" as const },
    } : {}),
    ...(employment.length ? { employment } : {}),
    ...(education.length ? { education } : {}),
    ...(skills.length ? { skills } : {}),
    ...(certifications.length ? { certifications } : {}),
    ...(languages.length ? { languages } : {}),
    ...(projects.length ? { projects } : {}),
    ...(additionalSections.length ? { additionalSections } : {}),
    packageContext: {
      selectedPackage: profile.selectedPackage,
      targetMarkets: [...(profile.targetMarkets ?? [])],
    },
    ...(hasText(profile.gccPhoto?.id) ? { gccPhotoFileId: profile.gccPhoto.id } : {}),
  };

  if (!hasText(profile.fullName)) finding("missing_full_name", "error", "identity.fullName", "A full name is required for document output.");
  if (!hasText(profile.primaryEmail)) finding("missing_primary_email", "error", "identity.primaryEmail", "A primary contact email is required for document output.");
  if (!hasText(profile.mobileNumber)) finding("missing_mobile_number", "error", "identity.mobileNumber", "A mobile number is required for document output.");
  if (!hasText(profile.selectedPackage)) finding("missing_package", "error", "packageContext.selectedPackage", "A selected package is required.");
  if (!profile.targetMarkets?.length) finding("missing_target_market", "error", "packageContext.targetMarkets", "At least one target market is required.");

  const hasCareerFacts = employment.length > 0 || education.length > 0 || skills.length > 0 ||
    certifications.length > 0 || projects.length > 0 || languages.length > 0 || additionalSections.length > 0;
  if (purpose === "resume" && !hasCareerFacts) {
    finding("missing_resume_content", "error", "sections", "At least one structured career section is required for a resume.");
  }
  if (purpose === "cover-letter" && !hasCareerFacts && !data.professionalSummary) {
    finding("missing_cover_letter_context", "error", "sections", "A summary or structured career section is required for a cover letter.");
  }
  return { data, findings, canGenerate: !findings.some((item) => item.severity === "error") };
}
