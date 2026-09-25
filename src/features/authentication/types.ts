export type AuthPortalIntent = "admin" | "client";

export type PasswordSignInCredentials = {
  email: string;
  password: string;
  portal: AuthPortalIntent;
};

export type PasswordSignInResult = {
  email: string | null;
  portal: AuthPortalIntent;
  redirectTo: "/admin" | "/client";
  userId: string;
};

export type AuthServiceErrorCode =
  | "configuration"
  | "invalid-credentials"
  | "email-unconfirmed"
  | "authentication";
