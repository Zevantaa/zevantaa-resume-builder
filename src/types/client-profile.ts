import type { TimestampAuditFields } from "./audit";
import type { EntityId, YearMonth } from "./core";
import type {
  PrivateFileReference,
  ProfilePhotoFileExtension,
  ProfilePhotoMimeType,
  ResumeFileExtension,
  ResumeFileMimeType,
} from "./file-upload";

export type RelocationPreference =
  | "open"
  | "not-open"
  | "conditional"
  | "not-specified";

export type TargetMarket =
  | "indian-domestic"
  | "gcc-middle-east"
  | "european-union";

/** Identifiers only; package configuration belongs to a later tracker task. */
export type V1PackageCode =
  | "indian-domestic"
  | "gcc-middle-east"
  | "europass-european-union"
  | "domestic-gcc"
  | "domestic-europass-european-union"
  | "global-mobility-master"
  | "executive-transition-agency-distribution";

export type LanguageProficiency =
  | "basic"
  | "conversational"
  | "professional-working"
  | "fluent"
  | "native-or-bilingual";

export interface OrderedProfileItem {
  id: EntityId;
  sortOrder: number;
}

export interface WorkExperienceEntry extends OrderedProfileItem {
  employerName: string;
  jobTitle: string;
  startDate: YearMonth;
  currentRole: boolean;
  endDate?: YearMonth;
  location?: string;
  /** Candidate-supplied role narrative and responsibilities. */
  description?: string;
  /** Candidate-supplied, evidence-backed achievements; never inferred. */
  highlights: string[];
}

export interface EducationEntry extends OrderedProfileItem {
  institutionName: string;
  qualification: string;
  fieldOfStudy?: string;
  startDate?: YearMonth;
  endDate?: YearMonth;
  location?: string;
  /** Candidate-supplied grade, classification, GPA, or result, if relevant. */
  gradeResult?: string;
  highlights: string[];
}

export interface SkillEntry extends OrderedProfileItem {
  name: string;
  category?: string;
}

export interface CertificationEntry extends OrderedProfileItem {
  name: string;
  issuingOrganization: string;
  issuedOn?: YearMonth;
  expiresOn?: YearMonth;
  credentialId?: string;
  credentialUrl?: string;
}

export interface LanguageEntry extends OrderedProfileItem {
  name: string;
  proficiency?: LanguageProficiency;
}

export interface ProjectEntry extends OrderedProfileItem {
  name: string;
  role?: string;
  startDate?: YearMonth;
  endDate?: YearMonth;
  description?: string;
  highlights: string[];
  technologies: string[];
  url?: string;
}

export interface AdditionalProfileSectionItem extends OrderedProfileItem {
  heading: string;
  subheading?: string;
  dateLabel?: string;
  description?: string;
  highlights: string[];
  url?: string;
}

/**
 * Flexible container for candidate-provided resume content that does not fit a
 * standard section. Consumers must not generate or infer missing content.
 */
export interface AdditionalProfileSection extends OrderedProfileItem {
  title: string;
  items: AdditionalProfileSectionItem[];
}

/**
 * Authoritative structured candidate record used by all later document
 * templates. Arrays are required but may be empty when a section is not
 * applicable or the candidate has not supplied content.
 */
export interface CandidateProfile extends TimestampAuditFields {
  id: EntityId;

  fullName: string;
  primaryEmail: string;
  mobileNumber: string;
  whatsappNumber?: string;
  linkedinUrl?: string;
  currentLocation: string;
  relocationPreference: RelocationPreference;

  selectedPackage: V1PackageCode;
  targetMarkets: TargetMarket[];

  existingResume: PrivateFileReference<
    ResumeFileMimeType,
    ResumeFileExtension
  >;
  gccPhoto?: PrivateFileReference<
    ProfilePhotoMimeType,
    ProfilePhotoFileExtension
  >;

  professionalSummary?: string;
  workExperience: WorkExperienceEntry[];
  education: EducationEntry[];
  skills: SkillEntry[];
  certifications: CertificationEntry[];
  languages: LanguageEntry[];
  projects: ProjectEntry[];
  additionalSections: AdditionalProfileSection[];

}

/** Client-facing naming for the same authoritative candidate record. */
export type ClientProfile = CandidateProfile;
