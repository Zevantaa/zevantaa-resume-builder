"use client";

import { RouteError } from "@/components/ui/route-error";

export default function AdminError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} homeHref="/admin" homeLabel="Return to admin overview" reset={reset} />;
}
