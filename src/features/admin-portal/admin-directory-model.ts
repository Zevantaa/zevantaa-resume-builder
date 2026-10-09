import { getPackageRouting } from "@/features/document-generation/package-routing";

export const ADMIN_DIRECTORY_PAGE_SIZE = 25;
export const ADMIN_DIRECTORY_SCAN_LIMIT = 2000;

export type AdminReviewStatus = "needs-resume" | "under-review" | "reviewed";
export type AdminDirectoryRow = {
  userId: string;
  profileId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  whatsappNumber: string | null;
  linkedinUrl: string | null;
  packageCode: string | null;
  packageName: string;
  accountStatus: string;
  resumeStatus: AdminReviewStatus;
  hasSourceResume: boolean;
  generatedFileCount: number;
};
export type AdminDirectoryFilters = {
  search: string;
  packageCode: string;
  status: AdminReviewStatus | "all";
  page: number;
};

export function parseAdminDirectoryFilters(input: {
  q?: string | string[];
  package?: string | string[];
  status?: string | string[];
  page?: string | string[];
}): AdminDirectoryFilters {
  const first = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
  const search = first(input.q).trim().replace(/\s+/gu, " ").slice(0, 80);
  const packageCode = first(input.package);
  const status = first(input.status);
  const pageValue = first(input.page);
  return {
    search,
    packageCode,
    status: status === "needs-resume" || status === "under-review" || status === "reviewed" ? status : "all",
    page: /^\d{1,4}$/u.test(pageValue) ? Math.max(1, Number(pageValue)) : 1,
  };
}

export function getAdminResumeStatus(currentResumeId: string | null, available: boolean, confirmed: boolean): AdminReviewStatus {
  if (!currentResumeId || !available) return "needs-resume";
  return confirmed ? "reviewed" : "under-review";
}

export function packageNameForDirectory(code: string | null): string {
  if (!code) return "Not assigned";
  return getPackageRouting(code)?.displayName ?? "Unknown package";
}

export function filterAdminDirectory(rows: AdminDirectoryRow[], filters: AdminDirectoryFilters): AdminDirectoryRow[] {
  const needle = filters.search.toLocaleLowerCase();
  return rows.filter((row) => {
    if (filters.packageCode && row.packageCode !== filters.packageCode) return false;
    if (filters.status !== "all" && row.resumeStatus !== filters.status) return false;
    if (!needle) return true;
    return [row.fullName, row.email, row.mobileNumber, row.whatsappNumber, row.linkedinUrl]
      .some((value) => value?.toLocaleLowerCase().includes(needle));
  });
}

export function directoryHref(base: string, filters: AdminDirectoryFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.packageCode) params.set("package", filters.packageCode);
  if (filters.status !== "all") params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
