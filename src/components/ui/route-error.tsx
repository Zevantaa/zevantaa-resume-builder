"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type RouteErrorProps = {
  error: Error & { digest?: string };
  homeHref: string;
  homeLabel: string;
  reset: () => void;
};

/** Recoverable, privacy-safe route failure UI. Error details never reach the DOM. */
export function RouteError({ error, homeHref, homeLabel, reset }: RouteErrorProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [error]);

  return <main className="route-error-page">
    <section aria-labelledby="route-error-heading" className="route-error-card" role="alert">
      <p className="type-label dashboard-kicker">Secure recovery</p>
      <h1 className="type-heading-1" id="route-error-heading" ref={headingRef} tabIndex={-1}>
        This page could not be loaded
      </h1>
      <p className="type-body text-text-muted">
        Your data was not changed. Try loading the page again, or return to a safe starting point.
      </p>
      <div className="route-error-actions">
        <button className="auth-submit type-button" onClick={reset} type="button">Try again</button>
        <Link className="auth-secondary-button type-button" href={homeHref}>{homeLabel}</Link>
      </div>
    </section>
  </main>;
}
