import { InlineAlert } from "@/components/ui";
import { getClientIntakeFiles } from "@/features/client-portal/client-intake-service";
import { ExtractionTestPanel } from "@/features/document-generation/extraction-test-panel";

export const dynamic = "force-dynamic";

export default async function ClientExtractionTestPage() {
  const files = await getClientIntakeFiles();
  const resume = files?.resume;

  return (
    <div className="dashboard-page dashboard-profile-content layout-stack">
      <header className="client-profile-intro">
        <p className="type-label dashboard-kicker">Development QA — Resume Extraction</p>
        <h1 className="type-heading-1 text-text">Private source resume extraction</h1>
        <p className="type-body text-text-muted">
          Temporary QA screen. Text is previewed only in this session; it is not saved or mapped into your profile.
        </p>
      </header>
      <section className="dashboard-workspace-panel" aria-label="Current source resume">
        <div className="dashboard-module-heading">
          <h2 className="type-heading-3">Current source resume</h2>
          <p className="type-supporting text-text-muted">Only your currently linked private upload is processed.</p>
        </div>
        {resume ? (
          <dl className="dashboard-detail-list">
            <div><dt>Filename</dt><dd>{resume.originalFileName}</dd></div>
            <div><dt>Type</dt><dd>{resume.mimeType}</dd></div>
            <div><dt>File status</dt><dd>{resume.status}</dd></div>
          </dl>
        ) : (
          <InlineAlert variant="information">No source resume is linked to your profile. Upload one from My profile &amp; intake before running this QA check.</InlineAlert>
        )}
        <ExtractionTestPanel />
      </section>
    </div>
  );
}
