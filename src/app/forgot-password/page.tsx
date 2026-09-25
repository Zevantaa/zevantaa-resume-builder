import {
  getAuthPortalIntent,
  PasswordRecoveryExperience,
} from "@/features/authentication";

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  const { portal } = await searchParams;

  return <PasswordRecoveryExperience portal={getAuthPortalIntent(portal)} />;
}
