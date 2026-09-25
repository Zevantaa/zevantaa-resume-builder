import Link from "next/link";
import { redirect } from "next/navigation";

import { PlaceholderPage } from "@/components/ui";
import { LogoutButton } from "@/features/authentication";
import {
  getAuthContext,
  getRequestedPortal,
} from "@/features/authentication/authorization";

export default async function AccessDeniedPage({
  searchParams,
}: PageProps<"/access-denied">) {
  const { portal } = await searchParams;
  const requestedPortal = getRequestedPortal(portal);
  const authContext = await getAuthContext();

  if (!authContext.userId) {
    redirect(`/login?portal=${requestedPortal}`);
  }

  const authorizedDestination = authContext.role
    ? `/${authContext.role}`
    : undefined;

  return (
    <PlaceholderPage
      actions={
        <div className="access-denied-actions">
          {authorizedDestination ? (
            <Link
              className="type-button auth-secondary-button auth-action-link"
              href={authorizedDestination}
            >
              Return to your portal
            </Link>
          ) : null}
          <LogoutButton portal={requestedPortal} />
        </div>
      }
      description="Your account does not have access to this portal."
      title="Access denied"
    />
  );
}
