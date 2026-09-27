import type { RelocationPreference } from "@/types/client-profile";

export type ProfileDetailsInput = {
  linkedinUrl: string;
  currentLocation: string;
  relocationPreference: string;
};

export type ProfileDetailsErrors = Partial<Record<keyof ProfileDetailsInput, string>>;

export type NormalizedProfileDetails = {
  linkedinUrl: string | null;
  currentLocation: string;
  relocationPreference: RelocationPreference;
};

const RELOCATION_VALUES = [
  "open",
  "not-open",
  "conditional",
  "not-specified",
] as const satisfies readonly RelocationPreference[];

function isRelocationPreference(value: string): value is RelocationPreference {
  return RELOCATION_VALUES.some((option) => option === value);
}

function normalizeLinkedInUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || /[\u0000-\u0020\u007f]/.test(trimmed)) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);
    const validHost = host === "linkedin.com" || host.endsWith(".linkedin.com");
    const validProfilePath =
      (segments[0] === "in" || segments[0] === "pub") &&
      segments.length >= 2 &&
      segments[1].length > 0;

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !validHost ||
      !validProfilePath ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    url.protocol = "https:";
    url.search = "";
    url.hash = "";
    url.pathname = `/${segments.join("/")}`;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateProfileDetails(input: ProfileDetailsInput): {
  errors: ProfileDetailsErrors;
  values: NormalizedProfileDetails;
} {
  const linkedinUrl = input.linkedinUrl.trim()
    ? normalizeLinkedInUrl(input.linkedinUrl)
    : null;
  const currentLocation = input.currentLocation
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
  const errors: ProfileDetailsErrors = {};

  if (input.linkedinUrl.trim() && !linkedinUrl) {
    errors.linkedinUrl = "Enter a LinkedIn personal profile URL, such as linkedin.com/in/name.";
  }
  if (
    currentLocation.length < 2 ||
    currentLocation.length > 160 ||
    !/\p{L}/u.test(currentLocation) ||
    /[\u0000-\u001f\u007f]/.test(currentLocation)
  ) {
    errors.currentLocation = "Enter your current city and country (2 to 160 characters).";
  }
  if (!isRelocationPreference(input.relocationPreference)) {
    errors.relocationPreference = "Select a valid relocation preference.";
  }

  return {
    errors,
    values: {
      linkedinUrl,
      currentLocation,
      relocationPreference: isRelocationPreference(input.relocationPreference)
        ? input.relocationPreference
        : "not-specified",
    },
  };
}
