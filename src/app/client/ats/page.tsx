import { InlineAlert, PageHeader } from "@/components/ui";
import { getCurrentClientAtsComparison, getCurrentClientAtsStatus } from "@/features/client-portal/client-ats-score-service";
import { IndicativeAtsPanel } from "@/features/document-generation/indicative-ats-panel";
import { DocumentAtsComparisonCard } from "@/features/document-generation/document-ats-comparison-card";
import { getCurrentClientDocumentAtsComparison } from "@/features/document-generation/document-ats-comparison-service";

export default async function ClientAtsPage() {
  const [status, comparison, documentComparison] = await Promise.all([
    getCurrentClientAtsStatus(), getCurrentClientAtsComparison(), getCurrentClientDocumentAtsComparison(),
  ]);
  const score = status?.score ?? null;
  const compatibility = status?.compatibility ?? null;
  return <div className="dashboard-page layout-container-readable layout-stack client-v8-ats-page">
    <PageHeader
      description="A rules-based indicator calculated from your reviewed profile. Versioned snapshots support a transparent comparison after verified profile changes."
      eyebrow="Global ATS resume"
      title="ATS status"
    />
    <DocumentAtsComparisonCard comparison={documentComparison} />
    {compatibility && <section className="regional-intake-card" aria-labelledby="jd-score-heading">
      <h2 id="jd-score-heading">Job-description keyword compatibility: {compatibility.score}/100</h2>
      <p>This separate rules-based measure checks exact keywords against confirmed career facts. Version: {compatibility.algorithmVersion}.
        It is indicative, not a third-party ATS score, certification, or hiring guarantee.</p>
      <p>Source: {compatibility.source === "client-confirmed-keywords" ? "your confirmed keyword list" : "the top meaningful terms in your job description"}.
        Matched {compatibility.matched.length} of {compatibility.considered.length} terms.</p>
      {compatibility.matched.length > 0 && <p><strong>Present:</strong> {compatibility.matched.join(", ")}</p>}
      {compatibility.missing.length > 0 && <p><strong>Not found in confirmed career facts:</strong> {compatibility.missing.join(", ")}</p>}
    </section>}
    {score ? <IndicativeAtsPanel result={score} comparison={comparison} /> :
      <InlineAlert variant="error">Your linked profile is unavailable. Please contact Zevantaa support.</InlineAlert>}
  </div>;
}
