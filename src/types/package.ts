import type { TargetMarket, V1PackageCode } from "./client-profile";

export type ResumeFormatFamily =
  | "global-ats"
  | "domestic"
  | "gcc-middle-east"
  | "europass-european-union";

/**
 * Reference to a cover-letter entitlement/configuration defined separately.
 * No package-specific entitlement is inferred when this field is absent.
 */
export type CoverLetterConfigurationRef = string;

export interface V1PackageDefinition {
  code: V1PackageCode;
  displayName: string;
  targetMarkets: readonly TargetMarket[];
  resumeFormatFamilies: readonly ResumeFormatFamily[];
  coverLetterConfigurationRef?: CoverLetterConfigurationRef;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Frozen V1 package catalog. Consumers should use `sortOrder` when presenting
 * packages and must not infer deliverables beyond the declared families.
 */
export const V1_PACKAGE_DEFINITIONS = [
  {
    code: "indian-domestic",
    displayName: "Indian Domestic",
    targetMarkets: ["indian-domestic"],
    resumeFormatFamilies: ["global-ats", "domestic"],
    isActive: true,
    sortOrder: 1,
  },
  {
    code: "gcc-middle-east",
    displayName: "GCC / Middle East",
    targetMarkets: ["gcc-middle-east"],
    resumeFormatFamilies: ["global-ats", "gcc-middle-east"],
    isActive: true,
    sortOrder: 2,
  },
  {
    code: "europass-european-union",
    displayName: "Europass / EU",
    targetMarkets: ["european-union"],
    resumeFormatFamilies: ["global-ats", "europass-european-union"],
    isActive: true,
    sortOrder: 3,
  },
  {
    code: "domestic-gcc",
    displayName: "Domestic + GCC",
    targetMarkets: ["indian-domestic", "gcc-middle-east"],
    resumeFormatFamilies: ["global-ats", "domestic", "gcc-middle-east"],
    isActive: true,
    sortOrder: 4,
  },
  {
    code: "domestic-europass-european-union",
    displayName: "Domestic + Europass / EU",
    targetMarkets: ["indian-domestic", "european-union"],
    resumeFormatFamilies: [
      "global-ats",
      "domestic",
      "europass-european-union",
    ],
    isActive: true,
    sortOrder: 5,
  },
  {
    code: "global-mobility-master",
    displayName: "Domestic + GCC + Europass",
    targetMarkets: [
      "indian-domestic",
      "gcc-middle-east",
      "european-union",
    ],
    resumeFormatFamilies: [
      "global-ats",
      "domestic",
      "gcc-middle-east",
      "europass-european-union",
    ],
    isActive: true,
    sortOrder: 6,
  },
  {
    code: "executive-transition-agency-distribution",
    displayName: "Executive All-Inclusive",
    targetMarkets: [
      "indian-domestic",
      "gcc-middle-east",
      "european-union",
    ],
    resumeFormatFamilies: [
      "global-ats",
      "domestic",
      "gcc-middle-east",
      "europass-european-union",
    ],
    isActive: true,
    sortOrder: 7,
  },
] as const satisfies readonly V1PackageDefinition[];
