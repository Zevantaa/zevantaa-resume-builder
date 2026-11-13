import Link from "next/link";

import { PageHeader, StatusBadge } from "@/components/ui";

import { ArchivedClientControls } from "./client-lifecycle-controls";
import { listArchivedClients } from "./client-lifecycle-service";

export async function ArchivedClientListPage() {
  const clients = await listArchivedClients();
  return <div className="dashboard-page dashboard-workspace-page archived-client-page">
    <PageHeader eyebrow="Admin portal · Recoverable lifecycle" title="Archived Clients"
      description="Archived clients cannot access the application or receive new processing work. Restore remains available only during the recorded recovery period." />
    <div className="archived-client-list">
      {clients.map((client) => <article className="dashboard-workspace-panel archived-client-card" key={client.profileId}>
        <div><h2 className="type-heading-3">{client.fullName}</h2><StatusBadge variant="neutral">Archived</StatusBadge></div>
        <dl className="dashboard-detail-list">
          <div><dt>Email</dt><dd>{client.email}</dd></div><div><dt>Package</dt><dd>{client.packageCode}</dd></div>
          <div><dt>Documents</dt><dd>{client.documentCount}</dd></div><div><dt>Uploads</dt><dd>{client.uploadedFileCount}</dd></div>
          <div><dt>Archived</dt><dd>{new Date(client.archivedAt).toLocaleString("en-IN")}</dd></div>
          <div><dt>Recovery until</dt><dd>{client.recoveryUntil ? new Date(client.recoveryUntil).toLocaleString("en-IN") : "Legacy archive · manual review required"}</dd></div>
        </dl>
        <ArchivedClientControls client={client} recoverable={client.recoverable} />
      </article>)}
      {!clients.length && <section className="dashboard-workspace-panel"><h2 className="type-heading-3">No archived clients</h2>
        <p className="type-supporting text-text-muted">Recoverably deleted clients will appear here.</p></section>}
    </div>
    <Link className="type-button dashboard-text-link" href="/admin/clients">Return to active clients</Link>
  </div>;
}
