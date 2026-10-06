import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAlert } from "@/components/ui";
import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { loadAdminGccPhotoReference } from "@/features/document-generation/gcc-photo-service";
import { isGccPackageEligible } from "@/features/document-generation/gcc-resume";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminGccResumePage({ params }: PageProps<"/admin/clients/[userId]/gcc-resume">) {
  const { userId } = await params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) notFound();
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");
  const eligible = isGccPackageEligible(mapping.data);
  const photo = await loadAdminGccPhotoReference(profile.id);
  const ready = eligible && mapping.canGenerate;
  return <div className="dashboard-page layout-container-readable layout-stack">
    <header className="layout-stack">
      <p className="type-label text-text-muted">Admin portal · GCC resume</p>
      <h1 className="type-heading-1">GCC resume for {profile.fullName}</h1>
      <p className="type-body text-text-muted">A private PDF built from the current reviewed profile. The optional professional photograph is included only when its private file can be safely decoded.</p>
    </header>
    <section className="dashboard-workspace-panel layout-stack">
      <h2 className="type-heading-3">Readiness</h2>
      <p className="type-body">Package: {eligible ? "GCC output included" : "GCC output not included"}</p>
      <p className="type-body">Photograph: {photo ? "Private GCC photo linked" : "No usable GCC photo linked — the no-photo layout will be used"}</p>
      {photo ? <p className="type-supporting text-text-muted">A corrupt or unreadable linked image is safely omitted at download time.</p> : null}
      {!eligible ? <InlineAlert variant="warning">The assigned package does not include a GCC resume.</InlineAlert> : null}
      {mapping.findings.filter((finding) => finding.severity === "error").map((finding) =>
        <InlineAlert key={finding.code} variant="error">{finding.message}</InlineAlert>)}
      {ready ? <form action={`/admin/clients/${encodeURIComponent(userId)}/gcc-resume/download`} method="post">
        <button className="auth-submit type-button" type="submit">Download GCC Resume PDF</button>
      </form> : <p className="type-supporting text-text-muted">Resolve package or required-profile gaps before downloading.</p>}
    </section>
    <Link className="type-label admin-table-link" href={`/admin/clients/${encodeURIComponent(userId)}/edit`}>Return to client account</Link>
  </div>;
}
