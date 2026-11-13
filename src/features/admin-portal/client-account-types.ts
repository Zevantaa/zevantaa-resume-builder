export type ClientAccountStatus = "active" | "disabled";
export type ClientInvitationDeliveryStatus = "not-sent" | "pending" | "sent" | "failed";

export type CandidateAccountOption = {
  email: string;
  id: string;
  name: string;
  mobileNumber: string;
  whatsappNumber: string;
  linkedinUrl: string;
  currentLocation: string;
  relocationPreference: string;
  packageCode: string;
};

export type PackageAssignmentOption = {
  code: string;
  displayName: string;
};

export type ProvisionedClientSummary = {
  accountStatus: ClientAccountStatus;
  candidateProfileId: string;
  email: string;
  fullName: string;
  packageCode: string;
  packageName: string;
  userId: string;
};

export type ProvisionedClientDetail = ProvisionedClientSummary & {
  packages: PackageAssignmentOption[];
  mobileNumber: string;
  whatsappNumber: string;
  linkedinUrl: string;
  currentLocation: string;
  relocationPreference: string;
};

export type AdminProfileFields = {
  fullName: string;
  email: string;
  mobileNumber: string;
  whatsappNumber: string | null;
  linkedinUrl: string | null;
  currentLocation: string;
  relocationPreference: "open" | "not-open" | "conditional" | "not-specified";
  packageCode: string;
};

export type ClientAccountFormState = {
  fieldErrors?: Partial<
    Record<"candidateProfileId" | "fullName" | "email" | "mobileNumber" | "whatsappNumber" | "linkedinUrl" | "currentLocation" | "relocationPreference" | "packageCode" | "accountStatus", string>
  >;
  message?: string;
  status: "idle" | "success" | "error";
  invitation?: {
    email: string;
    deliveryStatus: ClientInvitationDeliveryStatus;
    invitationId: string;
  };
};

export const initialClientAccountFormState: ClientAccountFormState = {
  status: "idle",
};

export type EditClientAccountFormState = {
  fieldErrors?: Partial<Record<"fullName" | "email" | "mobileNumber" | "whatsappNumber" | "linkedinUrl" | "currentLocation" | "relocationPreference" | "packageCode" | "accountStatus" | "confirmation", string>>;
  message?: string;
  status: "idle" | "success" | "error";
  /** Increments on every successful submission, including consecutive saves. */
  saveRevision?: number;
};

export const initialEditClientAccountFormState: EditClientAccountFormState = {
  status: "idle",
};
