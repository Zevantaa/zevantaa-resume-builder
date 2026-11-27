/** Client-confirmed optional facts for the existing V1 document outputs. */
export type GlobalAtsMarket = "india" | "global-mnc" | "usa" | "canada" | "uk" | "australia";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface CefrAssessment {
  language: string;
  listening: CefrLevel;
  reading: CefrLevel;
  spokenInteraction: CefrLevel;
  spokenProduction: CefrLevel;
  writing: CefrLevel;
}

export interface EqfQualification {
  educationId: string;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Candidate-provided source of the already verified classification. */
  verificationBasis: string;
}

export interface RegionalIntake {
  version: 1;
  global?: {
    market?: GlobalAtsMarket;
    targetJobTitle?: string;
    jobDescription?: string;
    targetKeywords?: string[];
    functionalCompetencies?: string[];
    technicalSkills?: string[];
    noticePeriod?: string;
    workAuthorization?: string;
  };
  gcc?: {
    nationality?: string;
    visaWorkStatus?: string;
    noticePeriod?: string;
    drivingLicence?: string;
    maritalStatus?: string;
    photoConsent?: boolean;
  };
  eu?: {
    motherTongue?: string;
    workAuthorization?: string;
    cefr?: CefrAssessment[];
    eqf?: EqfQualification[];
  };
}
