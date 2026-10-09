import Link from "next/link";

import { DataTable, StatusBadge, TableBody, TableCell, TableContainer,
  TableEmptyState, TableHeader, TableHeaderCell, TableRow } from "@/components/ui";
import { V1_PACKAGE_DEFINITIONS } from "@/types/package";

import { ADMIN_DIRECTORY_PAGE_SIZE, directoryHref, parseAdminDirectoryFilters } from "./admin-directory-model";
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
  const invalidPackageFilter = !!filters.packageCode &&
    !V1_PACKAGE_DEFINITIONS.some((item) => item.code === filters.packageCode);
  return <div className="dashboard-page dashboard-workspace-page admin-directory-page">
    <header className="dashboard-workspace-intro dashboard-admin-intro">
      <div>
        <p className="type-label dashboard-kicker">Zevantaa Master Admin Panel · Pipeline Control</p>
        <h1 className="type-heading-1">{mode === "overview" ? "Client overview" : "Master client directory"}</h1>
        <p className="type-body text-text-muted">Find a client, check review and document state, or open their existing management workspace.</p>
      </div>
      <Link className="type-button dashboard-primary-link" href="/admin/clients/new">Create client account</Link>
    </header>

    {mode === "overview" && <section aria-label="Operational overview" className="admin-directory-metrics">
      <div><strong>{data.metrics.clients}</strong><span>Provisioned clients</span></div>
      <div><strong>{data.metrics.sourceResumes}</strong><span>Source resumes uploaded</span></div>
      <div><strong>{data.metrics.awaitingReview}</strong><span>Awaiting resume review</span></div>
      <div><strong>{data.metrics.reviewed}</strong><span>Reviewed/confirmed</span></div>
      <div><strong>{data.metrics.generatedOnPage}</strong><span>Stored PDFs on this page</span></div>
    </section>}

    <section aria-labelledby="admin-directory-heading" className="dashboard-directory-section">
      <div className="dashboard-section-heading">
        <div><p className="type-label dashboard-kicker">Client pipeline</p>
          <h2 className="type-heading-2" id="admin-directory-heading">Master client directory</h2>
          <p className="type-supporting text-text-muted">Generated-file counts include verified, stored private PDFs only; on-demand generations are not counted.</p></div>
      </div>
      <form action={base} aria-label="Search and filter clients" className="admin-directory-filters" method="get">
        <label><span className="type-label">Search clients</span>
          <input className="form-control" defaultValue={filters.search} maxLength={80} name="q" placeholder="Name, email, phone or LinkedIn" type="search" /></label>
        <label><span className="type-label">Package</span>
          <select className="form-control" defaultValue={filters.packageCode} name="package">
            <option value="">All packages</option>
            {invalidPackageFilter && <option value={filters.packageCode}>Unknown package filter</option>}
            {V1_PACKAGE_DEFINITIONS.map((item) => <option key={item.code} value={item.code}>{item.displayName}</option>)}
          </select></label>
        <label><span className="type-label">Resume status</span>
          <select className="form-control" defaultValue={filters.status} name="status">
            <option value="all">All statuses</option>
            <option value="needs-resume">Needs resume</option>
            <option value="under-review">Under review</option>
            <option value="reviewed">Reviewed/confirmed</option>
          </select></label>
        <button className="type-button dashboard-primary-link" type="submit">Apply filters</button>
      </form>
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
            </div></TableCell>
          </TableRow>) : <TableEmptyState colSpan={6} title="No matching clients" description="Adjust the search or filters, or create a client account." />}</TableBody>
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
