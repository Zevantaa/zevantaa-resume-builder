import { notFound } from "next/navigation";

import { PdfRenderQaPanel } from "@/features/document-generation/pdf/pdf-render-qa-panel";
import { areQaUtilitiesEnabled } from "@/lib/qa-utilities";

export const dynamic = "force-dynamic";

export default function AdminPdfRenderTestPage() {
  if (!areQaUtilitiesEnabled()) notFound();
  return (
    <div className="dashboard-page dashboard-profile-content layout-stack">
      <header className="client-profile-intro">
        <p className="type-label dashboard-kicker">Development QA — PDF Rendering</p>
        <h1 className="type-heading-1 text-text">PDF rendering foundation</h1>
        <p className="type-body text-text-muted">
          Temporary admin-only test data. These PDFs are not client resumes or production downloads.
          Open each PDF to inspect page flow and select, copy, or search its text.
        </p>
      </header>
      <PdfRenderQaPanel />
    </div>
  );
}
