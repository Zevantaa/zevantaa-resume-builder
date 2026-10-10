import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAlert } from "@/components/ui";
import { AdminPdfRequest } from "@/features/document-generation/admin-pdf-request";
import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { DOMESTIC_DESIGNS, isDomesticPackageEligible } from "@/features/document-generation/domestic-resumes";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminDomesticResumesPage({ params }: PageProps<"/admin/clients/[userId]/domestic-resumes">) {
  const { userId } = await params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) notFound();
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  const eligible = isDomesticPackageEligible(mapping.data);
  const ready = mapping.canGenerate && eligible;

  return <div className="dashboard-page layout-container-readable layout-stack admin-v8-generator">
    <header className="layout-stack">
      <p className="type-label text-text-muted">Admin portal · Domestic resume suite</p>
      <h1 className="type-heading-1">Domestic resumes for {profile.fullName}</h1>
      <p className="type-body text-text-muted">Five printable designs, all built from this client&apos;s current reviewed structured profile. PDFs are generated privately on demand.</p>
    </header>
    {!eligible ? <InlineAlert variant="warning">The assigned package does not include domestic resumes.</InlineAlert> : null}
    {mapping.findings.filter((finding) => finding.severity === "error").map((finding) =>
      <InlineAlert key={finding.code} variant="error">{finding.message}</InlineAlert>)}
    <ol className="layout-stack">
      {DOMESTIC_DESIGNS.map((design) => <li className="dashboard-workspace-panel layout-stack" key={design.id}>
        <div>
          <p className="type-label dashboard-kicker">Domestic Resume {design.id}</p>
          <h2 className="type-heading-3">{design.name}</h2>
          <p className="type-supporting text-text-muted">{design.description}</p>
        </div>
        {ready ? <AdminPdfRequest action={`/admin/clients/${encodeURIComponent(userId)}/domestic-resumes/download`}
          fields={{ design: String(design.id) }} label="Generate PDF" /> : <p className="type-supporting text-text-muted">Resolve package or required-profile gaps before generating.</p>}
      </li>)}
    </ol>
    <Link className="type-label admin-table-link" href={`/admin/clients/${encodeURIComponent(userId)}/edit`}>Return to client account</Link>
  </div>;
}
