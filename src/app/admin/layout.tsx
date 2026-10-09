import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavigationItem } from "@/components/dashboard/dashboard-shell";
import { requireApplicationRole } from "@/features/authentication/authorization";

const navigation: readonly DashboardNavigationItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/clients", label: "Client directory" },
  { href: "/admin/clients/new", label: "Create client" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/workflow", label: "Workflow", note: "Coming later" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireApplicationRole("admin");

  return <DashboardShell navigation={navigation} portal="admin">{children}</DashboardShell>;
}
