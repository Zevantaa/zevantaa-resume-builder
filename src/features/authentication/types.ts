export type AuthPortalIntent = "admin" | "client";

export type ApplicationRole = AuthPortalIntent;

export type AuthContext = {
  role: ApplicationRole | null;
  userId: string | null;
};

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

export type PasswordRecoveryRequest = {
  email: string;
  portal: AuthPortalIntent;
  redirectOrigin: string;
};

export type PasswordUpdateRequest = {
  password: string;
};

export type SignOutResult = {
  redirectTo: `/login?portal=${AuthPortalIntent}`;
};

export type AuthServiceErrorCode =
  | "configuration"
  | "invalid-credentials"
  | "authentication"
  | "password-recovery"
  | "password-update"
  | "sign-out";
