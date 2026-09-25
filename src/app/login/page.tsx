import {
  getAuthPortalIntent,
  LoginExperience,
} from "@/features/authentication";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { portal } = await searchParams;

  return <LoginExperience portal={getAuthPortalIntent(portal)} />;
}
