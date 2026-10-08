import Link from "next/link";

import { InlineAlert, StatusBadge } from "@/components/ui";
import { IndicativeAtsPanel } from "@/features/document-generation/indicative-ats-panel";
import { getPackageRouting, packageAllowsOutput } from "@/features/document-generation/package-routing";

import { getClientDashboardSummary } from "./contact-profile-service";
import { getCurrentClientAtsScore } from "./client-ats-score-service";
import { TARGET_MARKET_LABELS } from "./target-market-labels";
import type { TargetMarket } from "@/types/client-profile";

export async function ClientDashboardPage() {
  const [summary, score] = await Promise.all([getClientDashboardSummary(), getCurrentClientAtsScore()]);
  const routing = getPackageRouting(summary?.packageCode);

  return (
    <div className="dashboard-page dashboard-workspace-page">
      <header className="dashboard-workspace-intro">
        <p className="type-label dashboard-kicker">Client portal</p>
        <h1 className="type-heading-1">Client Intake & Package Management</h1>
        <p className="type-body text-text-muted">
          Review your candidate details and assigned market package. Document outputs will appear here when generation is available.
        </p>
      </header>
      {!summary ? <InlineAlert variant="error">Your linked profile is unavailable. Please contact Zevantaa support.</InlineAlert> : (
        <div className="dashboard-client-modules">
          <section aria-labelledby="client-intake-heading" className="dashboard-workspace-panel dashboard-intake-panel">
            <div className="dashboard-module-heading">
              <span className="type-label dashboard-kicker">Module 01 · Your profile</span>
              <h2 className="type-heading-3" id="client-intake-heading">Client intake & package</h2>
            </div>
            <dl className="dashboard-detail-list">
              <div><dt>Full name</dt><dd>{summary.fullName}</dd></div>
              <div><dt>Primary email</dt><dd>{summary.primaryEmail}</dd></div>
              <div><dt>Mobile number</dt><dd>{summary.mobileNumber}</dd></div>
              <div><dt>WhatsApp number</dt><dd>{summary.whatsappNumber || "Not provided"}</dd></div>
            </dl>
            <div className="dashboard-assignment">
              <span className="type-label dashboard-kicker">Package / target market</span>
              <strong className="type-heading-4">{summary.packageName}</strong>
              <span className="type-supporting">Target markets: {summary.targetMarkets.map((market) => TARGET_MARKET_LABELS[market as TargetMarket] ?? market).join(" · ")}</span>
              <p className="type-supporting text-text-muted">Assigned by Zevantaa. Contact the administrator for package changes.</p>
            </div>
            <Link className="type-button dashboard-primary-link" href="/client/profile">Open my intake <span aria-hidden="true">→</span></Link>
            <p className="type-supporting text-text-muted">Review Zevantaa-managed details and upload or replace your source resume{routing?.gccPhotoAvailable ? " and optional GCC photograph" : ""}.</p>
          </section>

          <div className="dashboard-output-column">
            {routing?.atsScoreVisible && score ? <IndicativeAtsPanel result={score} /> : null}
            <section aria-labelledby="outputs-heading" className="dashboard-workspace-panel dashboard-outputs-panel">
              <div className="dashboard-module-heading">
                <span className="type-label dashboard-kicker">Module 02 · Output workspace</span>
                <h2 className="type-heading-3" id="outputs-heading">Resumes & cover letters</h2>
                <p className="type-supporting text-text-muted">Outputs included with your assigned package are shown below. Package availability does not mean a document is ready to generate or download.</p>
              </div>
              <div className="dashboard-output-list">
                {packageAllowsOutput(summary.packageCode, "global-ats-resume") && <div><strong>Global ATS resume</strong><StatusBadge variant="neutral">Not generated</StatusBadge></div>}
                {packageAllowsOutput(summary.packageCode, "domestic-resume-1") && <div><strong>Domestic resume layouts (1–5)</strong><StatusBadge variant="neutral">Not generated</StatusBadge></div>}
                {packageAllowsOutput(summary.packageCode, "gcc-resume") && <div><strong>GCC / Middle East resume</strong><StatusBadge variant="neutral">Not generated</StatusBadge></div>}
                {packageAllowsOutput(summary.packageCode, "europass-eu-resume") && <div><strong>Europass / EU resume</strong><StatusBadge variant="neutral">Not generated</StatusBadge></div>}
                {packageAllowsOutput(summary.packageCode, "general-corporate-cover-letter") && <div><strong>Cover letters</strong><StatusBadge variant="neutral">Not generated</StatusBadge></div>}
                {!routing && <p className="type-supporting">This package is unavailable. Contact Zevantaa support.</p>}
              </div>
              <p className="type-supporting text-text-muted">Generation and download access depend on the assigned package and the reviewed profile’s readiness.</p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
