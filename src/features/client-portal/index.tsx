import { PlaceholderPage } from "@/components/ui";
import { LogoutButton } from "@/features/authentication";

export function ClientPortalPlaceholder() {
  return (
    <PlaceholderPage
      actions={<LogoutButton portal="client" />}
      title="Client Portal"
      description="The client workspace will be implemented here."
    />
  );
}
