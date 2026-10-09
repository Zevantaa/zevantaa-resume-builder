import Link from "next/link";
import { notFound } from "next/navigation";

import { getProvisionedClient } from "@/features/admin-portal/client-account-service";
import { getAdminStoredDocuments } from "@/features/admin-portal/admin-directory-service";
import { getPackageRouting } from "@/features/document-generation/package-routing";

const generatorLinks = [
  { output: "global-ats-resume", label: "Global ATS generator", path: "global-ats" },
  { output: "domestic-resume-1", label: "Domestic resume generators", path: "domestic-resumes" },
  { output: "gcc-resume", label: "GCC resume generator", path: "gcc-resume" },
  { output: "europass-eu-resume", label: "European resume generator", path: "european-resume" },
  { output: "general-corporate-cover-letter", label: "Cover-letter generators", path: "cover-letters" },
] as const;

export default async function AdminClientDocumentsPage({ params }: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const client = await getProvisionedClient(userId);
  if (!client) notFound();
  const documents = await getAdminStoredDocuments(client.candidateProfileId);
  const routing = getPackageRouting(client.packageCode);
  return <div className="dashboard-page dashboard-workspace-page admin-client-documents-page">
    <header className="dashboard-workspace-intro">
      <p className="type-label dashboard-kicker">Admin · Client documents</p>
      <h1 className="type-heading-1">{client.fullName}</h1>
      <p className="type-body text-text-muted">Stored PDF downloads and on-demand generators are separate. Package: {client.packageName}.</p>
    </header>
    <section aria-labelledby="stored-documents-heading" className="dashboard-workspace-panel">
      <h2 className="type-heading-3" id="stored-documents-heading">Available stored PDFs ({documents.length})</h2>
      {documents.length ? <ul className="admin-stored-document-list">{documents.map((document) => <li key={document.id}>
        <span>{document.label} · {new Date(document.createdAt).toLocaleDateString("en-IN")}</span>
        <Link href={`/admin/clients/${userId}/documents/${document.id}/download`}>Download stored PDF</Link>
      </li>)}</ul> : <p className="type-supporting text-text-muted">No verified, stored generated PDFs are available for this client yet.</p>}
    </section>
    <section aria-labelledby="generators-heading" className="dashboard-workspace-panel">
      <h2 className="type-heading-3" id="generators-heading">Open an on-demand generator</h2>
      <p className="type-supporting text-text-muted">These routes generate a new PDF on request. They are not stored downloads and are not counted above.</p>
      <div className="admin-generator-links">{generatorLinks.filter((link) => routing?.allowedOutputs.some((output) => output === link.output))
        .map((link) => <Link key={link.path} href={`/admin/clients/${userId}/${link.path}`}>{link.label}</Link>)}</div>
      {!routing && <p className="type-supporting text-text-muted">No generator entitlement is available for this package.</p>}
    </section>
    <Link className="type-button dashboard-text-link" href={`/admin/clients/${userId}/edit`}>Return to client record</Link>
  </div>;
}
