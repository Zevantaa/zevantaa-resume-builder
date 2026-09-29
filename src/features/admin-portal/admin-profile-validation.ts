import { validateContactProfile } from "../client-portal/contact-profile-validation";
import { validateProfileDetails } from "../client-portal/profile-details-validation";

import type { AdminProfileFields } from "./client-account-types";

export type AdminProfileInput = {
  fullName: string;
  email: string;
  mobileNumber: string;
  whatsappNumber: string;
  linkedinUrl: string;
  currentLocation: string;
  relocationPreference: string;
  packageCode: string;
};

export function validateAdminProfile(input: AdminProfileInput): {
  errors: Partial<Record<keyof AdminProfileInput, string>>;
  values: AdminProfileFields;
} {
  const contact = validateContactProfile({
    fullName: input.fullName,
    primaryEmail: input.email,
    mobileNumber: input.mobileNumber,
    whatsappNumber: input.whatsappNumber,
    sameAsMobile: false,
  });
  const details = validateProfileDetails({
    linkedinUrl: input.linkedinUrl,
    currentLocation: input.currentLocation,
    relocationPreference: input.relocationPreference,
  });
  const errors: Partial<Record<keyof AdminProfileInput, string>> = {
    fullName: contact.errors.fullName,
    email: contact.errors.primaryEmail,
    mobileNumber: contact.errors.mobileNumber,
    whatsappNumber: contact.errors.whatsappNumber,
    linkedinUrl: details.errors.linkedinUrl,
    currentLocation: details.errors.currentLocation,
    relocationPreference: details.errors.relocationPreference,
  };
  if (!input.packageCode.trim()) errors.packageCode = "Select a package.";
  for (const key of Object.keys(errors) as (keyof AdminProfileInput)[]) {
    if (!errors[key]) delete errors[key];
  }
  return {
    errors,
    values: {
      fullName: contact.values.fullName,
      email: contact.values.primaryEmail,
      mobileNumber: contact.values.mobileNumber,
      whatsappNumber: contact.values.whatsappNumber,
      linkedinUrl: details.values.linkedinUrl,
      currentLocation: details.values.currentLocation,
      relocationPreference: details.values.relocationPreference,
      packageCode: input.packageCode.trim(),
    },
  };
}
