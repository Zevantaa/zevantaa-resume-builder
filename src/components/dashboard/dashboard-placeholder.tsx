import Link from "next/link";

export function DashboardPlaceholder({
  backHref,
  description,
  title,
}: {
  backHref: string;
  description: string;
  title: string;
}) {
  return (
    <div className="dashboard-page dashboard-placeholder-page">
      <header className="dashboard-page-heading">
        <p className="type-label dashboard-kicker">Workspace</p>
        <h1 className="type-heading-1">{title}</h1>
        <p className="type-body text-text-muted">{description}</p>
      </header>
      <section className="dashboard-placeholder-panel" aria-label={`${title} status`}>
        <p className="type-label dashboard-kicker">In preparation</p>
        <h2 className="type-heading-3">This area is not available yet</h2>
        <p className="type-body text-text-muted">
          The navigation is in place, but no document or workflow actions are active on this screen.
        </p>
        <Link className="type-button dashboard-text-link" href={backHref}>
          Return to overview
        </Link>
      </section>
    </div>
  );
}
