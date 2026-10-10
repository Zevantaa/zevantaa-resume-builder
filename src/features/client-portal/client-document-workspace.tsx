import Link from "next/link";

import { InlineAlert, StatusBadge } from "@/components/ui";

import { getCurrentClientAtsScore } from "./client-ats-score-service";
import { getClientDashboardEvidence } from "./client-dashboard-service";
import { buildClientDashboardView } from "./client-dashboard-view";
import { getClientDashboardSummary } from "./contact-profile-service";

export async function ClientDocumentWorkspace({ coverLettersOnly = false }: { coverLettersOnly?: boolean }) {
  const [summary, evidence, score] = await Promise.all([
    getClientDashboardSummary(), getClientDashboardEvidence(), getCurrentClientAtsScore(),
  ]);
  const view = buildClientDashboardView(summary, evidence, score);
  const outputs = view.outputs.filter((item) => item.id.endsWith("cover-letter") === coverLettersOnly);
  return <div className="dashboard-page dashboard-workspace-page client-v8-documents">
    <header className="layout-stack">
      <p className="type-label dashboard-kicker">Client portal · Output workspace</p>
      <h1 className="type-heading-1">{coverLettersOnly ? "Cover letters" : "Resumes & documents"}</h1>
      <p className="type-body text-text-muted">Only outputs in your assigned package appear here. A download is shown only for a verified saved PDF.</p>
    </header>
    {!summary || !evidence ? <InlineAlert variant="error">Your linked profile is unavailable. Please contact Zevantaa support.</InlineAlert> :
      <section className="dashboard-workspace-panel" aria-label={coverLettersOnly ? "Cover-letter availability" : "Resume availability"}>
        {!view.routing ? <InlineAlert variant="warning">Assigned package unavailable. Contact Zevantaa support.</InlineAlert> :
          <div className="client-v8-doc-library">
            {outputs.map((item) => <article className="client-v8-doc-card" key={item.id}>
              <div className="client-v8-doc-card-top"><span aria-hidden="true" className="client-v8-doc-icon">{item.label.slice(0, 2).toUpperCase()}</span>
                <StatusBadge variant={item.documentId ? "success" : "neutral"}>{item.documentId ? "Available" : item.state}</StatusBadge></div>
              <h2 className="type-heading-3">{item.label}</h2>
              <p className="type-supporting text-text-muted">{item.documentId ? "Verified private PDF · current stored version" : "No verified stored PDF yet"}</p>
              {item.documentId ? <Link className="type-button dashboard-primary-link" href={`/client/documents/${item.documentId}/download`}>Download PDF</Link>
                : <span className="type-supporting text-text-muted">Zevantaa will prepare this entitled output.</span>}
            </article>)}
            {!outputs.length && <p className="type-supporting text-text-muted">This package does not include {coverLettersOnly ? "cover letters" : "resume outputs"}. Contact Zevantaa if you need a different package.</p>}
            {outputs.length > 0 && outputs.every((item) => !item.documentId) &&
              <InlineAlert variant="information">No stored PDFs are available yet. Zevantaa will make eligible documents available after profile review and document preparation.</InlineAlert>}
          </div>}
      </section>}
    <Link className="type-button dashboard-text-link" href="/client">Return to overview</Link>
  </div>;
}
