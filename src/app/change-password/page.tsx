import { redirect } from "next/navigation";

import { AuthExperienceShell } from "@/features/authentication/auth-experience-shell";
import { requireApplicationRole } from "@/features/authentication/authorization";
import { ChangeTemporaryPasswordForm } from "@/features/authentication/change-temporary-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const auth = await requireApplicationRole("client");
  if (!auth.mustChangePassword) redirect("/client");
  return <AuthExperienceShell
    description="Replace the one-time credential before accessing private candidate information."
    eyebrow="First sign-in"
    heading="Create your private password"
  >
    <ChangeTemporaryPasswordForm />
  </AuthExperienceShell>;
}
