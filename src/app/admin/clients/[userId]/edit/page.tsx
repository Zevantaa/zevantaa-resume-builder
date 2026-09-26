import { EditClientAccountPage } from "@/features/admin-portal/edit-client-account-page";

export default async function EditClientRoute({
  params,
}: PageProps<"/admin/clients/[userId]/edit">) {
  const { userId } = await params;

  return <EditClientAccountPage userId={userId} />;
}
