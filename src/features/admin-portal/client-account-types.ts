export type ClientAccountStatus = "active" | "disabled";
export type CredentialMode = "generated" | "manual";

export type CandidateAccountOption = {
  email: string;
  id: string;
  name: string;
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
};

export type ClientAccountFormState = {
  fieldErrors?: Partial<
    Record<"candidateProfileId" | "email" | "temporaryPassword" | "accountStatus", string>
  >;
  message?: string;
  status: "idle" | "success" | "error";
  credentials?: {
    email: string;
    temporaryPassword: string;
  };
};

export const initialClientAccountFormState: ClientAccountFormState = {
  status: "idle",
};

export type EditClientAccountFormState = {
  fieldErrors?: Partial<Record<"email" | "packageCode" | "accountStatus" | "confirmation", string>>;
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialEditClientAccountFormState: EditClientAccountFormState = {
  status: "idle",
};
