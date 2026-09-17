import Link from "next/link";

import {
  CardTableStyleDemo,
  FormStyleDemo,
  StatusAlertStyleDemo,
} from "@/components/ui";

export default function HomePage() {
  return (
    <main className="layout-page flex flex-1 items-center justify-center bg-background">
      <section className="layout-container-readable layout-inset layout-stack rounded-lg border border-border bg-surface">
        <h1 className="type-heading-1 text-text">
          Zevantaa Resume Builder
        </h1>
        <p className="type-body text-text-muted">
          Phase 2 application foundation.
        </p>
        <nav aria-label="Placeholder routes">
          <ul className="layout-cluster">
            <li>
              <Link
                className="type-label text-text underline decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href="/login"
              >
                Login
              </Link>
            </li>
            <li>
              <Link
                className="type-label text-text underline decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href="/admin"
              >
                Admin portal
              </Link>
            </li>
            <li>
              <Link
                className="type-label text-text underline decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                href="/client"
              >
                Client portal
              </Link>
            </li>
          </ul>
        </nav>
        <FormStyleDemo />
        <CardTableStyleDemo />
        <StatusAlertStyleDemo />
      </section>
    </main>
  );
}
