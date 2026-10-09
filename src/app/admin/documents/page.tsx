import Link from "next/link";

export default function AdminDocumentsPage() {
  return <div className="dashboard-page dashboard-workspace-page admin-directory-page">
    <header className="dashboard-workspace-intro">
      <p className="type-label dashboard-kicker">Admin · Document access</p>
      <h1 className="type-heading-1">Client documents</h1>
      <p className="type-body text-text-muted">Open a client record to see verified stored PDFs separately from on-demand generators.</p>
    </header>
    <Link className="type-button dashboard-primary-link" href="/admin/clients">Find a client</Link>
  </div>;
}
