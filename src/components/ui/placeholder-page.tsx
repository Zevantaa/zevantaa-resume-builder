import Link from "next/link";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <section className="w-full max-w-2xl rounded-lg border border-border bg-surface p-8">
        <h1 className="text-3xl font-semibold text-text">{title}</h1>
        <p className="mt-4 text-text-muted">{description}</p>
        <Link
          className="mt-6 inline-block text-text underline decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href="/"
        >
          Return to home
        </Link>
      </section>
    </main>
  );
}
