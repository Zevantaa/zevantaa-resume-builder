import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
      <section className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-8">
        <h1 className="text-3xl font-semibold text-zinc-950">
          Zevantaa Resume Builder
        </h1>
        <p className="mt-4 text-zinc-600">Phase 2 application foundation.</p>
        <nav className="mt-6" aria-label="Placeholder routes">
          <ul className="flex flex-wrap gap-4">
            <li>
              <Link className="underline" href="/login">
                Login
              </Link>
            </li>
            <li>
              <Link className="underline" href="/admin">
                Admin portal
              </Link>
            </li>
            <li>
              <Link className="underline" href="/client">
                Client portal
              </Link>
            </li>
          </ul>
        </nav>
      </section>
    </main>
  );
}
