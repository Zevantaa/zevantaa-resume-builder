import Link from "next/link";

import { PlaceholderPage } from "@/components/ui";
import { LogoutButton } from "@/features/authentication";

export function AdminPortalPlaceholder() {
  return (
    <PlaceholderPage
      actions={
        <div className="access-denied-actions">
          <Link
            className="type-button auth-submit auth-action-link"
            href="/admin/clients/new"
          >
            Create client account
          </Link>
          <Link
            className="type-button auth-secondary-button auth-action-link"
            href="/admin/clients"
          >
            Manage client accounts
          </Link>
          <LogoutButton portal="admin" />
        </div>
      }
      title="Admin Portal"
      description="Create and manage the client access required for frozen V1."
    />
  );
}
