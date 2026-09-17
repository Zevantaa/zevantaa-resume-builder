import Link from "next/link";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
      <section className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-8">
        <h1 className="text-3xl font-semibold text-zinc-950">{title}</h1>
        <p className="mt-4 text-zinc-600">{description}</p>
        <Link className="mt-6 inline-block underline" href="/">
          Return to home
        </Link>
      </section>
    </main>
  );
}
