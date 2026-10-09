import { ClientListPage } from "@/features/admin-portal/client-list-page";

export default async function AdminClientsRoute({ searchParams }: {
  searchParams: Promise<{ q?: string; package?: string; status?: string; page?: string }>;
}) {
  return <ClientListPage searchParams={await searchParams} />;
}
