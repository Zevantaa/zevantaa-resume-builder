import { AuthExperienceShell } from "./auth-experience-shell";
import { ForgotPasswordForm } from "./forgot-password-form";
import type { AuthPortalIntent } from "./types";

export function PasswordRecoveryExperience({
  portal,
}: {
  portal: AuthPortalIntent;
}) {
  return (
    <AuthExperienceShell
      description="Enter the email address associated with your Zevantaa account."
      eyebrow="Account recovery"
      heading="Reset your password"
    >
      <ForgotPasswordForm portal={portal} />
    </AuthExperienceShell>
  );
}
