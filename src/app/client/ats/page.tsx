import { InlineAlert, PageHeader } from "@/components/ui";
import { getCurrentClientAtsComparison, getCurrentClientAtsScore } from "@/features/client-portal/client-ats-score-service";
import { IndicativeAtsPanel } from "@/features/document-generation/indicative-ats-panel";

export default async function ClientAtsPage() {
  const [score, comparison] = await Promise.all([getCurrentClientAtsScore(), getCurrentClientAtsComparison()]);
  return <div className="dashboard-page layout-container-readable layout-stack client-v8-ats-page">
    <PageHeader
      description="A rules-based indicator calculated from your reviewed profile. Versioned snapshots support a transparent comparison after verified profile changes."
      eyebrow="Global ATS resume"
      title="ATS status"
    />
    {score ? <IndicativeAtsPanel result={score} comparison={comparison} /> :
      <InlineAlert variant="error">Your linked profile is unavailable. Please contact Zevantaa support.</InlineAlert>}
  </div>;
}
