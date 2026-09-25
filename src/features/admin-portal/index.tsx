import { PlaceholderPage } from "@/components/ui";
import { LogoutButton } from "@/features/authentication";

export function AdminPortalPlaceholder() {
  return (
    <PlaceholderPage
      actions={<LogoutButton portal="admin" />}
      title="Admin Portal"
      description="The master administrator workspace will be implemented here."
    />
  );
}
