import Link from "next/link";

import { DataTable, PageHeader, StatusBadge, TableBody, TableCell, TableContainer,
  TableEmptyState, TableHeader, TableHeaderCell, TableRow } from "@/components/ui";

import { getAdminWorkflowOverview } from "./admin-workflow-service";

export async function AdminWorkflowPage() {
  const data = await getAdminWorkflowOverview();
  const cards = [
    ["Invitations", `${data.onboarding.activated} activated`, `${data.onboarding.awaitingActivation} awaiting activation · ${data.onboarding.pending} pending · ${data.onboarding.failed} failed · ${data.onboarding.notSent} not sent`],
    ["Resume extraction", `${data.extraction.completed} completed`, `${data.extraction.pending} pending · ${data.extraction.processing} processing · ${data.extraction.needsInput} need input · ${data.extraction.failed} failed`],
    ["Document generation", `${data.generation.completed} completed`, `${data.generation.pending} pending · ${data.generation.processing} processing · ${data.generation.failed} failed`],
    ["Published outputs", `${data.availableDocuments} available`, "Current private generated documents"],
  ];
  return <div className="dashboard-page dashboard-workspace-page">
    <PageHeader eyebrow="Operations · Durable state" title="Automation workflow"
      description="Live queue and delivery states. Counts are database records, not simulated progress."
      actions={<Link className="type-button dashboard-primary-link" href="/admin/clients/new">Invite client</Link>} />
    <section aria-label="Workflow status" className="admin-directory-metrics">
      {cards.map(([label, value, detail]) => <div key={label}><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>)}
    </section>
    <section className="dashboard-directory-section" aria-labelledby="workflow-errors">
      <div className="dashboard-section-heading"><div>
        <p className="type-label dashboard-kicker">Action required</p>
        <h2 className="type-heading-2" id="workflow-errors">Recent recoverable failures</h2>
        <p className="type-supporting text-text-muted">Controlled error codes expose no resume content, invitation tokens, or credentials.</p>
      </div></div>
      <TableContainer><DataTable caption="Recent workflow failures">
        <TableHeader><TableRow><TableHeaderCell>Area</TableHeaderCell><TableHeaderCell>Profile</TableHeaderCell>
          <TableHeaderCell>Error</TableHeaderCell><TableHeaderCell>Attempts</TableHeaderCell><TableHeaderCell>Updated</TableHeaderCell></TableRow></TableHeader>
        <TableBody>{data.errors.length ? data.errors.map((error) => <TableRow key={`${error.area}-${error.profileId}-${error.updatedAt}`}>
          <TableCell><StatusBadge variant="warning">{error.area}</StatusBadge></TableCell>
          <TableCell><code>{error.profileId}</code></TableCell><TableCell>{error.code}</TableCell>
          <TableCell>{error.attempts}</TableCell><TableCell>{new Date(error.updatedAt).toLocaleString("en-GB")}</TableCell>
        </TableRow>) : <TableEmptyState colSpan={5} title="No recorded failures" description="No failed invitation, extraction, or generation records are currently present." />}</TableBody>
      </DataTable></TableContainer>
    </section>
  </div>;
}
