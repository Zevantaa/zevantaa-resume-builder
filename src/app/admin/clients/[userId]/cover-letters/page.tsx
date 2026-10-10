import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAlert } from "@/components/ui";
import { AdminPdfRequest } from "@/features/document-generation/admin-pdf-request";
import { loadAdminCandidateProfile } from "@/features/document-generation/admin-global-ats-service";
import { buildCoverLetterContent, COVER_LETTER_LABELS, COVER_LETTER_TYPES,
  CoverLetterNotReadyError, isCoverLetterPackageEligible } from "@/features/document-generation/cover-letters";
import { mapCandidateProfileToDocumentData } from "@/features/document-generation/profile-mapper";
import type { CoverLetterType } from "@/types/document-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const purpose: Record<CoverLetterType, string> = {
  "general-corporate": "Neutral corporate introduction grounded in the reviewed profile.",
  "international-relocation": "International introduction; relocation is mentioned only when explicitly recorded.",
  "technology-startup": "Contemporary introduction; project and technology details appear only when supplied.",
};

export default async function AdminCoverLettersPage({ params }: PageProps<"/admin/clients/[userId]/cover-letters">) {
  const { userId } = await params;
  const profile = await loadAdminCandidateProfile(userId);
  if (!profile) notFound();
  const mapping = mapCandidateProfileToDocumentData(profile, "cover-letter");
  const eligible = isCoverLetterPackageEligible(mapping.data);
  const readiness = COVER_LETTER_TYPES.map((type) => {
    try { buildCoverLetterContent(mapping, type); return { type, ready: true }; }
    catch (error) { if (!(error instanceof CoverLetterNotReadyError)) throw error; return { type, ready: false }; }
  });
  return <div className="dashboard-page layout-container-readable layout-stack">
    <header className="layout-stack">
      <p className="type-label text-text-muted">Admin portal · Cover letters</p>
      <h1 className="type-heading-1">Cover letters for {profile.fullName}</h1>
      <p className="type-body text-text-muted">Private PDFs assembled deterministically from the current reviewed profile. No company, recruiter or candidate facts are invented.</p>
    </header>
    <section className="dashboard-workspace-panel layout-stack">
      <h2 className="type-heading-3">Package and profile readiness</h2>
      <p className="type-body">Package: {eligible ? "Executive All-Inclusive — cover letters included" : "Cover-letter entitlement not established"}</p>
      {!eligible ? <InlineAlert variant="warning">The frozen V1 catalog does not grant cover letters to this package.</InlineAlert> : null}
      {!eligible ? <p className="type-supporting text-text-muted">Review the client&apos;s assigned package in account management if cover letters are required.</p> : null}
      {mapping.findings.filter((finding) => finding.severity === "error").map((finding) =>
        <InlineAlert key={finding.code} variant="error">{finding.message}</InlineAlert>)}
      {eligible && mapping.canGenerate && readiness.every((item) => !item.ready)
        ? <InlineAlert variant="warning">More reviewed career context is needed for a credible letter.</InlineAlert> : null}
    </section>
    {readiness.map(({ type, ready }) => <section className="dashboard-workspace-panel layout-stack" key={type}>
      <h2 className="type-heading-3">{COVER_LETTER_LABELS[type]}</h2>
      <p className="type-body text-text-muted">{purpose[type]}</p>
      <p className="type-supporting">{ready ? "Ready to download" : "Not ready"}</p>
      {ready ? <AdminPdfRequest action={`/admin/clients/${encodeURIComponent(userId)}/cover-letters/download`}
        fields={{ type }} label={`Generate ${COVER_LETTER_LABELS[type]} PDF`} /> : null}
    </section>)}
    <Link className="type-label admin-table-link" href={`/admin/clients/${encodeURIComponent(userId)}/edit`}>Return to client account</Link>
  </div>;
}
