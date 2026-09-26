export type ContactProfileFields = {
  fullName: string;
  primaryEmail: string;
  mobileNumber: string;
  whatsappNumber: string;
};

export type ContactProfileInput = ContactProfileFields & {
  sameAsMobile: boolean;
};

export type ContactProfileFieldErrors = Partial<
  Record<keyof ContactProfileFields, string>
>;

export type NormalizedContactProfile = Omit<
  ContactProfileFields,
  "whatsappNumber"
> & {
  whatsappNumber: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();

  if (!PHONE_CHARACTERS.test(trimmed)) {
    return null;
  }

  const normalized = trimmed.replace(/[\s().-]/g, "");
  const digits = normalized.replace(/^\+/, "");

  if (
    digits.length < 7 ||
    digits.length > 15 ||
    /^([0-9])\1+$/.test(digits) ||
    (normalized.startsWith("+") && digits.startsWith("0"))
  ) {
    return null;
  }

  return normalized;
}

export function validateContactProfile(input: ContactProfileInput): {
  errors: ContactProfileFieldErrors;
  values: NormalizedContactProfile;
} {
  const fullName = input.fullName.normalize("NFC").trim().replace(/\s+/g, " ");
  const primaryEmail = input.primaryEmail.trim().toLowerCase();
  const mobileNumber = normalizePhoneNumber(input.mobileNumber);
  const rawWhatsApp = input.whatsappNumber.trim();
  const whatsappNumber = input.sameAsMobile
    ? mobileNumber
    : rawWhatsApp
      ? normalizePhoneNumber(rawWhatsApp)
      : null;
  const errors: ContactProfileFieldErrors = {};

  if (
    fullName.length < 2 ||
    fullName.length > 120 ||
    !/\p{L}/u.test(fullName) ||
    /[\u0000-\u001f\u007f]/.test(fullName)
  ) {
    errors.fullName = "Enter a full name of 2 to 120 characters.";
  }

  if (primaryEmail.length > 254 || !EMAIL_PATTERN.test(primaryEmail)) {
    errors.primaryEmail = "Enter a valid email address.";
  }

  if (!mobileNumber) {
    errors.mobileNumber = "Enter a valid mobile number with 7 to 15 digits.";
  }

  if (!input.sameAsMobile && rawWhatsApp && !whatsappNumber) {
    errors.whatsappNumber =
      "Enter a valid WhatsApp number with 7 to 15 digits, or leave it blank.";
  }

  return {
    errors,
    values: {
      fullName,
      primaryEmail,
      mobileNumber: mobileNumber ?? "",
      whatsappNumber,
    },
  };
}
