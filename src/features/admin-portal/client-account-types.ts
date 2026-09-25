export type ClientAccountStatus = "active" | "disabled";
export type CredentialMode = "generated" | "manual";

export type CandidateAccountOption = {
  email: string;
  id: string;
  name: string;
};

export type ClientAccountFormState = {
  fieldErrors?: Partial<
    Record<"candidateProfileId" | "email" | "temporaryPassword", string>
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
