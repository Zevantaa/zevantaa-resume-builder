import Link from "next/link";

import { DataTable, PageHeader, StatusBadge, TableBody, TableCell, TableContainer,
  TableEmptyState, TableHeader, TableHeaderCell, TableRow } from "@/components/ui";
import { ADMIN_DIRECTORY_PAGE_SIZE, directoryHref, parseAdminDirectoryFilters } from "./admin-directory-model";
import { AdminDirectoryFilterForm } from "./admin-directory-filters";
import { getAdminDirectoryData } from "./admin-directory-service";

type SearchParams = { q?: string | string[]; package?: string | string[];
  status?: string | string[]; page?: string | string[] };

const statusLabel = {
  "needs-resume": "Needs resume",
  "under-review": "Under review",
  reviewed: "Reviewed/confirmed",
} as const;

export async function AdminDirectoryWorkspace({ mode, searchParams }: {
  mode: "overview" | "directory";
  searchParams: SearchParams;
}) {
  const filters = parseAdminDirectoryFilters(searchParams);
  const data = await getAdminDirectoryData(filters);
  const base = mode === "overview" ? "/admin" : "/admin/clients";
  return <div className="dashboard-page dashboard-workspace-page admin-directory-page">
    <PageHeader
      actions={<><Link className="type-button dashboard-text-link" href="/admin/clients/archived">Archived clients</Link>
        <Link className="type-button dashboard-primary-link" href="/admin/clients/new">Create client account</Link></>}
      className="dashboard-admin-intro"
      description="Find a client, check review and document state, or open their existing management workspace."
      eyebrow="Zevantaa Master Admin Panel · Pipeline Control"
      title={mode === "overview" ? "See what needs attention first." : "Clients"}
    />

    {mode === "overview" && <section aria-label="Operational overview" className="admin-directory-metrics">
      <div><strong>{data.metrics.clients}</strong><span>Provisioned clients</span></div>
      <div><strong>{data.metrics.sourceResumes}</strong><span>Source resumes uploaded</span></div>
      <div><strong>{data.metrics.awaitingReview}</strong><span>Awaiting resume review</span></div>
      <div><strong>{data.metrics.reviewed}</strong><span>Reviewed/confirmed</span></div>
      <div><strong>{data.metrics.generatedOnPage}</strong><span>Stored PDFs on this page</span></div>
    </section>}
    {mode === "overview" && <section aria-label="Priority pipeline" className="admin-v8-priority-band">
      <div><StatusBadge variant="warning">Needs review</StatusBadge><strong>{data.metrics.awaitingReview} source resume{data.metrics.awaitingReview === 1 ? "" : "s"}</strong>
        <span>Uploaded source files awaiting administrator confirmation.</span></div>
      <div><StatusBadge variant="neutral">Incomplete intake</StatusBadge><strong>{data.metrics.clients - data.metrics.sourceResumes} without a source resume</strong>
        <span>Source-file intake remains unfinished; career edits are separate.</span></div>
      <div><StatusBadge variant="success">Reviewed</StatusBadge><strong>{data.metrics.reviewed} confirmed source resume{data.metrics.reviewed === 1 ? "" : "s"}</strong>
        <span>Review confirmed; check each profile before generating documents.</span></div>
    </section>}

    <section aria-labelledby="admin-directory-heading" className="dashboard-directory-section">
      <div className="dashboard-section-heading">
        <div><p className="type-label dashboard-kicker">Client pipeline</p>
          <h2 className="type-heading-2" id="admin-directory-heading">Master client directory</h2>
          <p className="type-supporting text-text-muted">Generated-file counts include verified, stored private PDFs only; on-demand generations are not counted.</p></div>
      </div>
      <AdminDirectoryFilterForm base={base} filters={filters} />
      <p className="type-supporting text-text-muted admin-directory-count" role="status">
        {data.totalMatching} matching client{data.totalMatching === 1 ? "" : "s"} · Page {data.currentPage} of {data.pageCount}
      </p>
      <TableContainer className="admin-directory-table-container" tabIndex={0} aria-label="Client directory; scroll horizontally for more columns">
        <DataTable caption="Provisioned client directory">
          <TableHeader><TableRow>
            <TableHeaderCell>Client</TableHeaderCell><TableHeaderCell>Contact</TableHeaderCell>
            <TableHeaderCell>Package</TableHeaderCell><TableHeaderCell>Resume review</TableHeaderCell>
            <TableHeaderCell>Stored PDFs</TableHeaderCell><TableHeaderCell>Actions</TableHeaderCell>
          </TableRow></TableHeader>
          <TableBody>{data.rows.length ? data.rows.map((client) => <TableRow key={client.userId}>
            <TableCell><strong>{client.fullName || "Not available"}</strong>
              {client.accountStatus === "disabled" && <span className="type-supporting admin-directory-subline">Access disabled</span>}</TableCell>
            <TableCell><span className="admin-directory-contact">{client.email || "Not available"}</span>
              <span className="type-supporting admin-directory-subline">Mobile: {client.mobileNumber || "Not available"}</span>
              {client.whatsappNumber && <span className="type-supporting admin-directory-subline">WhatsApp: {client.whatsappNumber}</span>}</TableCell>
            <TableCell>{client.packageName}</TableCell>
            <TableCell><StatusBadge variant={client.resumeStatus === "reviewed" ? "success" : client.resumeStatus === "under-review" ? "warning" : "neutral"}>
              {statusLabel[client.resumeStatus]}</StatusBadge></TableCell>
            <TableCell>{client.generatedFileCount}</TableCell>
            <TableCell><div className="admin-directory-actions">
              <Link href={`/admin/clients/${client.userId}/edit`}>Open</Link>
              <Link href={`/admin/clients/${client.userId}/resume-review`}>Review</Link>
              <Link href={`/admin/clients/${client.userId}/documents`}>Documents</Link>
              <details className="admin-directory-more"><summary>More</summary>
                <Link href={`/admin/clients/${client.userId}/edit#client-access-details`}>Copy Access Details</Link>
                <Link href={`/admin/clients/${client.userId}/edit#client-lifecycle`}>Delete Client</Link>
              </details>
            </div></TableCell>
          </TableRow>) : data.metrics.clients === 0
            ? <TableEmptyState colSpan={6} title="No clients yet" description="Create a client account to start the intake and review pipeline." />
            : <TableEmptyState colSpan={6} title="No matching clients" description="Adjust the search or filters to find another client." />}</TableBody>
        </DataTable>
      </TableContainer>
      <nav aria-label="Directory pages" className="admin-directory-pagination">
        {data.currentPage > 1 && <Link href={directoryHref(base, filters, data.currentPage - 1)}>Previous</Link>}
        <span>Showing at most {ADMIN_DIRECTORY_PAGE_SIZE} clients per page</span>
        {data.currentPage < data.pageCount && <Link href={directoryHref(base, filters, data.currentPage + 1)}>Next</Link>}
      </nav>
    </section>
  </div>;
}
