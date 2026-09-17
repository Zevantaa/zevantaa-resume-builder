import Link from "next/link";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="layout-page flex flex-1 items-center justify-center bg-background">
      <section className="layout-container-readable layout-inset layout-stack rounded-lg border border-border bg-surface">
        <h1 className="type-heading-1 text-text">{title}</h1>
        <p className="type-body text-text-muted">{description}</p>
        <Link
          className="type-label inline-block text-text underline decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href="/"
        >
          Return to home
        </Link>
      </section>
    </main>
  );
}
