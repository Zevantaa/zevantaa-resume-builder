import Link from "next/link";

import { InlineAlert, PageHeader, StatusBadge } from "@/components/ui";
import { IndicativeAtsPanel } from "@/features/document-generation/indicative-ats-panel";
import { DocumentAtsComparisonCard } from "@/features/document-generation/document-ats-comparison-card";
import { getCurrentClientDocumentAtsComparison } from "@/features/document-generation/document-ats-comparison-service";

import { getCurrentClientAtsScore } from "./client-ats-score-service";
import { getClientDashboardEvidence } from "./client-dashboard-service";
import { buildClientDashboardView } from "./client-dashboard-view";
import { getClientDashboardSummary } from "./contact-profile-service";
import { TARGET_MARKET_LABELS } from "./target-market-labels";
import type { TargetMarket } from "@/types/client-profile";

export async function ClientDashboardPage() {
  const [summary, evidence, score, documentComparison] = await Promise.all([
    getClientDashboardSummary(), getClientDashboardEvidence(), getCurrentClientAtsScore(),
    getCurrentClientDocumentAtsComparison(),
  ]);
  const view = buildClientDashboardView(summary, evidence, score);

  return <div className="dashboard-page dashboard-workspace-page dashboard-client-home">
    <PageHeader
      description="Your Zevantaa package, reviewed profile, uploads and available documents in one place."
      eyebrow="Client portal · Your workspace"
      title={summary ? `Welcome, ${summary.fullName}` : "Client dashboard"}
    />

    {!summary || !evidence ? <InlineAlert variant="error">Your linked profile is unavailable. Please contact Zevantaa support.</InlineAlert> :
      <div className="dashboard-client-modules">
        <div className="dashboard-client-overview-column">
          <section aria-labelledby="client-package-heading" className="dashboard-workspace-panel dashboard-intake-panel">
            <div className="dashboard-module-heading">
              <span className="type-label dashboard-kicker">Module 01 · Your package</span>
              <h2 className="type-heading-3" id="client-package-heading">Package & profile</h2>
            </div>
            {view.routing ? <div className="dashboard-assignment">
              <strong className="type-heading-4">{view.routing.displayName}</strong>
              <span className="type-supporting">Target markets: {summary.targetMarkets.map((market) =>
                TARGET_MARKET_LABELS[market as TargetMarket] ?? market).join(" · ")}</span>
              <span className="type-supporting">Includes {view.outputs.filter((item) => !item.id.endsWith("cover-letter")).length} resume outputs
                {view.outputs.some((item) => item.id.endsWith("cover-letter")) ? " and 3 cover letters" : ""}.</span>
            </div> : <InlineAlert variant="warning">Assigned package unavailable. Contact Zevantaa support; no document entitlement is assumed.</InlineAlert>}
            <p className="type-supporting text-text-muted">Package and contact details are managed by Zevantaa, not editable here.</p>
            <div className="dashboard-status-line"><span>Profile status</span><StatusBadge variant={view.reviewConfirmed ? "success" : "neutral"}>{view.profileStatus}</StatusBadge></div>
            {!view.resumeAvailable && <InlineAlert variant="information">No source resume is available. Upload one from your profile to begin review.</InlineAlert>}
            {view.resumeAvailable && !view.reviewConfirmed && <InlineAlert variant="information">Review and confirm the extracted details before generation begins. A replacement never silently overwrites previously confirmed profile facts.</InlineAlert>}
            <Link className="type-button dashboard-primary-link" href="/client/profile">View profile & manage uploads <span aria-hidden="true">→</span></Link>
            <Link className="type-button dashboard-text-link" href="/client/career-profile">Update Career Profile</Link>
          </section>

          <section aria-labelledby="client-uploads-heading" className="dashboard-workspace-panel">
            <div className="dashboard-module-heading">
              <span className="type-label dashboard-kicker">Module 02 · Intake</span>
              <h2 className="type-heading-3" id="client-uploads-heading">Upload status</h2>
            </div>
            <div className="dashboard-output-list">
              <div><strong>Source resume</strong><StatusBadge variant={view.resumeAvailable ? "success" : "neutral"}>{!evidence.resume ? "Not uploaded" :
                view.reviewConfirmed ? "Reviewed/confirmed" : view.resumeAvailable ? "Uploaded · under review" : evidence.resume.status}</StatusBadge></div>
              {evidence.resume && <p className="type-supporting text-text-muted dashboard-upload-name">{evidence.resume.fileName}
                {evidence.resume.versionNumber > 1 ? ` · Version ${evidence.resume.versionNumber}` : ""}</p>}
              {view.routing?.gccPhotoAvailable && <div><strong>GCC photograph (optional)</strong>
                <StatusBadge variant={view.photoAvailable ? "success" : "neutral"}>{view.photoAvailable ? "Uploaded" : "Not uploaded"}</StatusBadge></div>}
              {view.routing?.gccPhotoAvailable && evidence.photo && <p className="type-supporting text-text-muted dashboard-upload-name">{evidence.photo.fileName}</p>}
            </div>
            <p className="type-supporting text-text-muted">A photograph is optional and does not block profile review or document readiness.</p>
            <Link className="type-button dashboard-text-link" href="/client/profile">Upload or replace source files</Link>
          </section>
        </div>

        <div className="dashboard-output-column">
          <DocumentAtsComparisonCard comparison={documentComparison} />
          {view.routing?.atsScoreVisible && score ? <IndicativeAtsPanel result={score} /> : null}
          <section aria-labelledby="outputs-heading" className="dashboard-workspace-panel dashboard-outputs-panel">
            <div className="dashboard-module-heading">
              <span className="type-label dashboard-kicker">Module 03 · Output workspace</span>
              <h2 className="type-heading-3" id="outputs-heading">Your documents</h2>
              <p className="type-supporting text-text-muted">Package entitlement does not mean a PDF has been generated. Only verified saved PDFs can be downloaded.</p>
            </div>
            <div className="dashboard-output-list">
              {view.outputs.map((item) => <div key={item.id}>
                <strong>{item.label}</strong>
                {item.documentId ? <Link className="type-button dashboard-text-link" href={`/client/documents/${item.documentId}/download`}>Download PDF</Link>
                  : <StatusBadge variant={item.state === "Update failed" ? "error" : "neutral"}>{item.state}</StatusBadge>}
              </div>)}
              {!view.outputs.length && <p className="type-supporting text-text-muted">No document outputs can be shown for this package. Contact Zevantaa support.</p>}
              {view.outputs.length > 0 && view.outputs.every((item) => !item.documentId) &&
                <InlineAlert variant="information">No stored PDFs are available yet. Every eligible document is queued automatically as soon as the profile is ready.</InlineAlert>}
            </div>
            <Link className="type-button dashboard-text-link" href="/client/documents">View document workspace</Link>
          </section>
        </div>
      </div>}
  </div>;
}
