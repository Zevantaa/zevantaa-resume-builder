import Link from "next/link";

import { PageHeader } from "@/components/ui";

export default function AdminDocumentsPage() {
  return <div className="dashboard-page dashboard-workspace-page admin-directory-page">
    <PageHeader
      description="Open a client record to see verified stored PDFs separately from on-demand generators."
      eyebrow="Admin · Document access"
      title="Client documents"
    />
    <Link className="type-button dashboard-primary-link" href="/admin/clients">Find a client</Link>
  </div>;
}
