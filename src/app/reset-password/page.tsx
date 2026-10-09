import {
  getAuthPortalIntent,
  ResetPasswordExperience,
} from "@/features/authentication";
import { hasVerifiedRecoverySession } from "@/features/authentication/recovery-session";

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { error, portal } = await searchParams;
  const canResetPassword = await hasVerifiedRecoverySession();

  return (
    <ResetPasswordExperience
      canResetPassword={canResetPassword}
      initialError={typeof error === "string" ? error : undefined}
      portal={getAuthPortalIntent(portal)}
    />
  );
}
