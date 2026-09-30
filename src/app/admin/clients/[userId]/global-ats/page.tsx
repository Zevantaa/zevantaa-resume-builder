import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAlert, SectionCard } from "@/components/ui";
import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminGlobalAtsPage({ params }: PageProps<"/admin/clients/[userId]/global-ats">) {
  const { userId } = await params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) notFound();
  const mapping = mapCandidateProfileToDocumentData(profile, "resume");

  return <div className="dashboard-page"><div className="layout-container-readable layout-stack">
    <header className="layout-stack">
      <p className="type-label text-text-muted">Admin QA · Global ATS Resume</p>
      <h1 className="type-heading-1">Global ATS Resume for {profile.fullName}</h1>
      <p className="type-body text-text-muted">
        This admin review path generates a single-column PDF from the saved structured profile. It does not parse the source upload,
        rewrite candidate facts, calculate an ATS score, or persist a generated document.
      </p>
    </header>
    <SectionCard title="Profile readiness" description="Only reviewed canonical data is eligible for PDF output.">
      {mapping.findings.length ? mapping.findings.map((finding, index) =>
        <InlineAlert key={`${finding.code}-${index}`} variant={finding.severity === "error" ? "error" : "warning"}>
          {finding.message}
        </InlineAlert>) : <p className="type-body">No required-data gaps were found.</p>}
      {mapping.canGenerate ? <form action={`/admin/clients/${encodeURIComponent(userId)}/global-ats/download`} method="post">
        <button className="auth-submit type-button" type="submit">Download Global ATS Resume PDF</button>
      </form> : <p className="type-body text-text-muted">Resolve the required data gaps before generating this resume.</p>}
    </SectionCard>
    <Link className="type-label admin-table-link" href={`/admin/clients/${encodeURIComponent(userId)}/edit`}>
      Return to client account
    </Link>
  </div></div>;
}
