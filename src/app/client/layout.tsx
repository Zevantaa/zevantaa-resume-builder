import type { ReactNode } from "react";

import { requireApplicationRole } from "@/features/authentication/authorization";

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireApplicationRole("client");

  return children;
}
