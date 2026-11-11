"use client";

import { RouteError } from "@/components/ui/route-error";

export default function ClientError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} homeHref="/client" homeLabel="Return to client overview" reset={reset} />;
}
