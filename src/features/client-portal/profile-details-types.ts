import type { ProfileDetailsErrors } from "./profile-details-validation";

export type ProfileDetailsActionState = {
  errors?: ProfileDetailsErrors;
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialProfileDetailsActionState: ProfileDetailsActionState = {
  status: "idle",
};
