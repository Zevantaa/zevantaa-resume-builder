import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <section className="w-full max-w-2xl rounded-lg border border-border bg-surface p-8">
        <h1 className="type-heading-1 text-text">
          Zevantaa Resume Builder
        </h1>
        <p className="type-body mt-4 text-text-muted">
          Phase 2 application foundation.
        </p>
        <nav className="mt-6" aria-label="Placeholder routes">
          <ul className="flex flex-wrap gap-4">
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
      </section>
    </main>
  );
}
