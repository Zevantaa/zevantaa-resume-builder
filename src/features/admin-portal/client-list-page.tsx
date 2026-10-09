import { AdminDirectoryWorkspace } from "./admin-directory-workspace";

export async function ClientListPage({ searchParams = {} }: {
  searchParams?: { q?: string | string[]; package?: string | string[];
    status?: string | string[]; page?: string | string[] };
}) {
  return <AdminDirectoryWorkspace mode="directory" searchParams={searchParams} />;
}
