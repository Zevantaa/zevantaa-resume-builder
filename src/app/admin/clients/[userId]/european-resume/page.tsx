import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAlert } from "@/components/ui";
import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { isEuropeanPackageEligible } from "@/features/document-generation/european-resume";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminEuropeanResumePage({ params }: PageProps<"/admin/clients/[userId]/european-resume">) {
  const { userId } = await params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) notFound();
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  const eligible = isEuropeanPackageEligible(mapping.data);
  const ready = eligible && mapping.canGenerate;
  return <div className="dashboard-page layout-container-readable layout-stack">
    <header className="layout-stack">
      <p className="type-label text-text-muted">Admin portal · European resume</p>
      <h1 className="type-heading-1">European resume for {profile.fullName}</h1>
      <p className="type-body text-text-muted">A European-structured, selectable-text PDF from the current reviewed profile. This is not an official Europass document.</p>
    </header>
    <section className="dashboard-workspace-panel layout-stack">
      <h2 className="type-heading-3">Readiness</h2>
      <p className="type-body">Package: {eligible ? "European output included" : "European output not included"}</p>
      {!eligible ? <InlineAlert variant="warning">The assigned package does not include a European resume.</InlineAlert> : null}
      {mapping.findings.filter((finding) => finding.severity === "error").map((finding) =>
        <InlineAlert key={finding.code} variant="error">{finding.message}</InlineAlert>)}
      {ready ? <form action={`/admin/clients/${encodeURIComponent(userId)}/european-resume/download`} method="post">
        <button className="auth-submit type-button" type="submit">Download European Resume PDF</button>
      </form> : <p className="type-supporting text-text-muted">Resolve package or required-profile gaps before downloading.</p>}
    </section>
    <Link className="type-label admin-table-link" href={`/admin/clients/${encodeURIComponent(userId)}/edit`}>Return to client account</Link>
  </div>;
}
