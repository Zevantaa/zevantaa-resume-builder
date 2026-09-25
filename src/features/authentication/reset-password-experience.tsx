import { AuthExperienceShell } from "./auth-experience-shell";
import { ResetPasswordForm } from "./reset-password-form";
import type { AuthPortalIntent } from "./types";

type ResetPasswordExperienceProps = {
  canResetPassword: boolean;
  initialError?: string;
  portal: AuthPortalIntent;
};

export function ResetPasswordExperience({
  canResetPassword,
  initialError,
  portal,
}: ResetPasswordExperienceProps) {
  return (
    <AuthExperienceShell
      description="Choose a new password for your Zevantaa account."
      eyebrow="Account recovery"
      heading="Create a new password"
    >
      <ResetPasswordForm
        canResetPassword={canResetPassword}
        initialError={initialError}
        portal={portal}
      />
    </AuthExperienceShell>
  );
}
