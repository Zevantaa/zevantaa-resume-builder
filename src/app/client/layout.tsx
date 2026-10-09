import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavigationItem } from "@/components/dashboard/dashboard-shell";
import { requireApplicationRole } from "@/features/authentication/authorization";

const navigation: readonly DashboardNavigationItem[] = [
  { href: "/client", label: "Overview" },
  { href: "/client/profile", label: "View profile & uploads" },
  { href: "/client/documents", label: "Resumes & documents" },
  { href: "/client/cover-letters", label: "Cover letters" },
  { href: "/client/ats", label: "ATS status" },
];

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireApplicationRole("client");

  return <DashboardShell navigation={navigation} portal="client">{children}</DashboardShell>;
}
