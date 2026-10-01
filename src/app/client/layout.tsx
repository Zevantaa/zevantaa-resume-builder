import type { ReactNode } from "react";

import { DashboardShell, type DashboardNavigationItem } from "@/components/dashboard/dashboard-shell";
import { requireApplicationRole } from "@/features/authentication/authorization";

const navigation: readonly DashboardNavigationItem[] = [
  { href: "/client", label: "Overview" },
  { href: "/client/profile", label: "My profile & intake" },
  { href: "/client/documents", label: "Resumes & documents", note: "Coming later" },
  { href: "/client/cover-letters", label: "Cover letters", note: "Coming later" },
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
