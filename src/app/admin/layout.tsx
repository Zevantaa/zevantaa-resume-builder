import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavigationItem } from "@/components/dashboard/dashboard-shell";
import { requireApplicationRole } from "@/features/authentication/authorization";
import { brandLogoPath, getBrandSettings } from "@/features/branding/brand-settings-service";

export const dynamic = "force-dynamic";

const navigation: readonly DashboardNavigationItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/clients", label: "Client directory" },
  { href: "/admin/clients/archived", label: "Archived clients" },
  { href: "/admin/clients/new", label: "Create client" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/workflow", label: "Workflow" },
  { href: "/admin/appearance", label: "Appearance" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [, branding] = await Promise.all([
    requireApplicationRole("admin"),
    getBrandSettings(),
  ]);
  return <DashboardShell navigation={navigation} portal="admin" logoSrc={brandLogoPath(branding)}>{children}</DashboardShell>;
}
