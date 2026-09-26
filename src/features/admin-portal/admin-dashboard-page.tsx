import Link from "next/link";

import {
  DataTable,
  StatusBadge,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";

import { listProvisionedClients } from "./client-account-service";

export async function AdminDashboardPage() {
  const clients = await listProvisionedClients();
  const activeCount = clients.filter((client) => client.accountStatus === "active").length;

  return (
    <div className="dashboard-page dashboard-workspace-page">
      <header className="dashboard-workspace-intro dashboard-admin-intro">
        <div>
          <p className="type-label dashboard-kicker">Module 03 · Master control</p>
          <h1 className="type-heading-1">Zevantaa Master Admin Panel & Pipeline Control</h1>
          <p className="type-body text-text-muted">Manage client accounts, package assignments and the master directory. Document and privacy controls remain pending.</p>
        </div>
        <Link className="type-button dashboard-primary-link" href="/admin/clients/new">Create client account <span aria-hidden="true">→</span></Link>
      </header>
      <section aria-label="Master control overview" className="dashboard-control-grid">
        <div><span className="type-label dashboard-kicker">01 · Active</span><h2 className="type-heading-4">Client directory</h2><p className="type-supporting text-text-muted">{clients.length} provisioned; {activeCount} active.</p></div>
        <div><span className="type-label dashboard-kicker">02 · Active</span><h2 className="type-heading-4">Package assignment</h2><p className="type-supporting text-text-muted">View and change packages in client management.</p></div>
        <div><span className="type-label dashboard-kicker">03 · Pending</span><h2 className="type-heading-4">Document auditing</h2><p className="type-supporting text-text-muted">Files and downloads are not available here yet.</p></div>
        <div><span className="type-label dashboard-kicker">04 · Pending</span><h2 className="type-heading-4">Privacy masking</h2><p className="type-supporting text-text-muted">Employer-review export is not active yet.</p></div>
      </section>
      <section aria-labelledby="admin-directory-heading" className="dashboard-directory-section">
        <div className="dashboard-section-heading">
          <div><p className="type-label dashboard-kicker">Pipeline control</p><h2 className="type-heading-2" id="admin-directory-heading">Master Client Directory</h2><p className="type-supporting text-text-muted">Provisioned clients, contact email, assigned package and access status.</p></div>
          <Link className="type-button dashboard-text-link" href="/admin/clients">Open full directory</Link>
        </div>
        <TableContainer>
          <DataTable caption="Master client directory preview">
            <TableHeader><TableRow><TableHeaderCell>Client</TableHeaderCell><TableHeaderCell>Contact email</TableHeaderCell><TableHeaderCell>Assigned package</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Privacy export</TableHeaderCell><TableHeaderCell>Action</TableHeaderCell></TableRow></TableHeader>
            <TableBody>
              {clients.length === 0 ? <TableEmptyState colSpan={6} title="No client accounts yet" description="Create a client account to populate the master directory." /> : clients.slice(0, 5).map((client) => (
                <TableRow key={client.userId}>
                  <TableCell>{client.fullName}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.packageName}</TableCell>
                  <TableCell><StatusBadge variant={client.accountStatus === "active" ? "success" : "neutral"}>{client.accountStatus === "active" ? "Active" : "Disabled"}</StatusBadge></TableCell>
                  <TableCell><span className="type-supporting text-text-muted">Not available yet</span></TableCell>
                  <TableCell><Link className="type-button dashboard-text-link" href={`/admin/clients/${client.userId}/edit`}>Manage</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableContainer>
      </section>
      <section aria-label="Privacy masking status" className="dashboard-upcoming-strip">
        <strong className="type-button">Employer-review privacy masking</strong>
        <span className="type-supporting">The separate masked export shown in the prototype is planned, not implemented.</span>
      </section>
    </div>
  );
}
