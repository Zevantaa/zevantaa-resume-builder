import Link from "next/link";

import { DataTable, PageHeader, StatusBadge, TableBody, TableCell, TableContainer,
  TableEmptyState, TableHeader, TableHeaderCell, TableRow } from "@/components/ui";

import { getAdminWorkflowOverview } from "./admin-workflow-service";
import { InvitationRetryButton } from "./invitation-retry-button";

export async function AdminWorkflowPage() {
  const data = await getAdminWorkflowOverview();
  const cards = [
    ["Invitations", `${data.onboarding.activated} activated`, `${data.onboarding.awaitingActivation} awaiting activation; ${data.onboarding.pending} pending; ${data.onboarding.failed} failed; ${data.onboarding.notSent} not sent`],
    ["Resume extraction", `${data.extraction.completed} completed`, `${data.extraction.pending} pending; ${data.extraction.processing} processing; ${data.extraction.needsInput} need input; ${data.extraction.failed} failed`],
    ["Document generation", `${data.generation.completed} completed`, `${data.generation.pending} pending; ${data.generation.processing} processing; ${data.generation.failed} failed`],
    ["Published outputs", `${data.availableDocuments} available`, "Current private generated documents"],
  ];
  return <div className="dashboard-page dashboard-workspace-page">
    <PageHeader eyebrow="Operations: Durable state" title="Automation workflow"
      description="Live queue and delivery states. Counts are database records, not simulated progress."
      actions={<Link className="type-button dashboard-primary-link" href="/admin/clients/new">Invite client</Link>} />
    <section aria-label="Workflow status" className="admin-directory-metrics">
      {cards.map(([label, value, detail]) => <div key={label}><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>)}
    </section>
    <section className="dashboard-directory-section" aria-labelledby="awaiting-invitations">
      <div className="dashboard-section-heading"><div>
        <p className="type-label dashboard-kicker">Account activation</p>
        <h2 className="type-heading-2" id="awaiting-invitations">Awaiting client setup</h2>
        <p className="type-supporting text-text-muted">Send a fresh one-time setup email only when the client reports an expired or invalid link.</p>
      </div></div>
      <TableContainer><DataTable caption="Client invitations awaiting activation">
        <TableHeader><TableRow><TableHeaderCell>Profile</TableHeaderCell><TableHeaderCell>Attempts</TableHeaderCell>
          <TableHeaderCell>Last sent</TableHeaderCell><TableHeaderCell>Action</TableHeaderCell></TableRow></TableHeader>
        <TableBody>{data.awaitingInvitations.length ? data.awaitingInvitations.map((invitation) => <TableRow key={invitation.invitationId}>
          <TableCell><code>{invitation.profileId}</code></TableCell><TableCell>{invitation.attempts}</TableCell>
          <TableCell>{new Date(invitation.updatedAt).toLocaleString("en-GB")}</TableCell>
          <TableCell><InvitationRetryButton invitationId={invitation.invitationId} /></TableCell>
        </TableRow>) : <TableEmptyState colSpan={4} title="No clients awaiting setup" description="Every sent invitation is activated, or no invitation has been sent yet." />}</TableBody>
      </DataTable></TableContainer>
    </section>
    <section className="dashboard-directory-section" aria-labelledby="workflow-errors">
      <div className="dashboard-section-heading"><div>
        <p className="type-label dashboard-kicker">Action required</p>
        <h2 className="type-heading-2" id="workflow-errors">Recent recoverable failures</h2>
        <p className="type-supporting text-text-muted">Controlled error codes expose no resume content, invitation tokens, or credentials.</p>
      </div></div>
      <TableContainer><DataTable caption="Recent workflow failures">
        <TableHeader><TableRow><TableHeaderCell>Area</TableHeaderCell><TableHeaderCell>Profile</TableHeaderCell>
          <TableHeaderCell>Error</TableHeaderCell><TableHeaderCell>Attempts</TableHeaderCell><TableHeaderCell>Updated</TableHeaderCell><TableHeaderCell>Action</TableHeaderCell></TableRow></TableHeader>
        <TableBody>{data.errors.length ? data.errors.map((error) => <TableRow key={`${error.area}-${error.profileId}-${error.updatedAt}`}>
          <TableCell><StatusBadge variant="warning">{error.area}</StatusBadge></TableCell>
          <TableCell><code>{error.profileId}</code></TableCell><TableCell>{error.code}</TableCell>
          <TableCell>{error.attempts}</TableCell><TableCell>{new Date(error.updatedAt).toLocaleString("en-GB")}</TableCell>
          <TableCell>{error.invitationId && error.attempts < 20
            ? <InvitationRetryButton invitationId={error.invitationId} label="Retry setup email" />
            : <span>Not available</span>}</TableCell>
        </TableRow>) : <TableEmptyState colSpan={6} title="No recorded failures" description="No failed invitation, extraction, or generation records are currently present." />}</TableBody>
      </DataTable></TableContainer>
    </section>
  </div>;
}
