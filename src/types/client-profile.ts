/** Stable application identifier, intended to map to a database UUID later. */
export type EntityId = string;

/** ISO 8601 date-time string, for example `2026-09-17T12:00:00.000Z`. */
export type IsoDateTime = string;

/** Calendar month string in `YYYY-MM` format. */
export type YearMonth = string;

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

export type ResumeFileMimeType =
  | "application/pdf"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type LanguageProficiency =
  | "basic"
  | "conversational"
  | "professional-working"
  | "fluent"
  | "native-or-bilingual";

export interface PrivateFileReference<TMimeType extends string = string> {
  id: EntityId;
  storagePath: string;
  originalFileName: string;
  mimeType: TMimeType;
  sizeBytes: number;
  uploadedAt: IsoDateTime;
}

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
  description?: string;
  highlights: string[];
}

export interface EducationEntry extends OrderedProfileItem {
  institutionName: string;
  qualification: string;
  fieldOfStudy?: string;
  startDate?: YearMonth;
  endDate?: YearMonth;
  location?: string;
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
export interface CandidateProfile {
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

  existingResume: PrivateFileReference<ResumeFileMimeType>;
  gccPhoto?: PrivateFileReference;

  professionalSummary?: string;
  workExperience: WorkExperienceEntry[];
  education: EducationEntry[];
  skills: SkillEntry[];
  certifications: CertificationEntry[];
  languages: LanguageEntry[];
  projects: ProjectEntry[];
  additionalSections: AdditionalProfileSection[];

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Client-facing naming for the same authoritative candidate record. */
export type ClientProfile = CandidateProfile;
