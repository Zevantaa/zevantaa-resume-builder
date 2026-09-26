import type {
  ContactProfileFieldErrors,
  ContactProfileFields,
} from "./contact-profile-validation";

export type ClientContactProfile = ContactProfileFields;

export type ContactProfileActionState = {
  errors?: ContactProfileFieldErrors;
  message?: string;
  savedValues?: ContactProfileFields;
  status: "idle" | "success" | "error";
};

export const initialContactProfileActionState: ContactProfileActionState = {
  status: "idle",
};
