import { AdminDirectoryWorkspace } from "./admin-directory-workspace";

export async function AdminDashboardPage({ searchParams = {} }: {
  searchParams?: { q?: string | string[]; package?: string | string[];
    status?: string | string[]; page?: string | string[] };
}) {
  return <AdminDirectoryWorkspace mode="overview" searchParams={searchParams} />;
}
