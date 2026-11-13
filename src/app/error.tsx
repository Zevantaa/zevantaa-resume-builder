"use client";

import { RouteError } from "@/components/ui/route-error";

export default function ApplicationError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} homeHref="/login" homeLabel="Return to sign in" reset={reset} />;
}
