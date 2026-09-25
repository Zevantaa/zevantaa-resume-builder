import type { ReactNode } from "react";

import { requireApplicationRole } from "@/features/authentication/authorization";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireApplicationRole("admin");

  return children;
}
