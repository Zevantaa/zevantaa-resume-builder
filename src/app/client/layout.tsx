import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavigationItem } from "@/components/dashboard/dashboard-shell";
import { requireApplicationRole } from "@/features/authentication/authorization";
import { brandLogoPath, getBrandSettings } from "@/features/branding/brand-settings-service";

export const dynamic = "force-dynamic";

const navigation: readonly DashboardNavigationItem[] = [
  { href: "/client", label: "Overview" },
  { href: "/client/profile", label: "View profile & uploads" },
  { href: "/client/career-profile", label: "Update career profile" },
  { href: "/client/documents", label: "Resumes & documents" },
  { href: "/client/cover-letters", label: "Cover letters" },
  { href: "/client/ats", label: "ATS status" },
];

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [, branding] = await Promise.all([
    requireApplicationRole("client"),
    getBrandSettings(),
  ]);
  return <DashboardShell navigation={navigation} portal="client" logoSrc={brandLogoPath(branding)}>{children}</DashboardShell>;
}
