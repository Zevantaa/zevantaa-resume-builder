import { InlineAlert } from "@/components/ui";
import { getCurrentClientAtsScore } from "@/features/client-portal/client-ats-score-service";
import { IndicativeAtsPanel } from "@/features/document-generation/indicative-ats-panel";

export default async function ClientAtsPage() {
  const score = await getCurrentClientAtsScore();
  return <div className="dashboard-page layout-container-readable layout-stack client-v8-ats-page">
    <header className="layout-stack">
      <p className="type-label dashboard-kicker">Global ATS resume</p>
      <h1 className="type-heading-1">ATS status</h1>
      <p className="type-body text-text-muted">A rules-based indicator calculated from your current reviewed profile. No score is stored or submitted from this page.</p>
    </header>
    {score ? <IndicativeAtsPanel result={score} /> :
      <InlineAlert variant="error">Your linked profile is unavailable. Please contact Zevantaa support.</InlineAlert>}
  </div>;
}
