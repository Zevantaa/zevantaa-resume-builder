import { AdminDashboardPage } from "@/features/admin-portal/admin-dashboard-page";

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ q?: string; package?: string; status?: string; page?: string }>;
}) {
  return <AdminDashboardPage searchParams={await searchParams} />;
}
