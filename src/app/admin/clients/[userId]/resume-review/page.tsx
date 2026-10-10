import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAlert, SectionCard, StatusBadge } from "@/components/ui";
import { AdminResumeReviewForm } from "@/features/document-generation/admin-resume-review-form";
import { getAdminResumeReview } from "@/features/document-generation/admin-resume-review-service";

export default async function AdminResumeReviewRoute({ params }: PageProps<"/admin/clients/[userId]/resume-review">) {
  const { userId } = await params;
  const review = await getAdminResumeReview(userId);
  if (!review) notFound();
  const { client, file, extraction, draft, sourceHash, canonicalSummary, priorReview } = review;
  return <div className="dashboard-page"><div className="layout-container-readable layout-stack">
    <header className="layout-stack">
      <p className="type-label text-text-muted">Admin portal · Resume review</p>
      <h1 className="type-heading-1">Review source resume for {client.fullName}</h1>
      <p className="type-body text-text-muted">Source text and proposals are not saved profile facts until an administrator confirms selected entries.</p>
    </header>
    <SectionCard title="Source and extraction" description="Current private source resume, resolved from this client’s linked profile.">
      <dl className="dashboard-detail-list">
        <div><dt>Filename</dt><dd>{file?.original_file_name ?? "No current source resume"}</dd></div>
        <div><dt>File type</dt><dd>{file?.mime_type ?? "—"}</dd></div>
        <div><dt>Extractor</dt><dd>{extraction.extractor ?? "—"}</dd></div>
        <div><dt>Pages</dt><dd>{extraction.pageCount ?? "Not available"}</dd></div>
      </dl>
      <StatusBadge variant={extraction.status === "success" ? "success" : "warning"}>{extraction.status}</StatusBadge>
      {!file && <InlineAlert variant="information">No source resume has been uploaded for this client. Ask the client to upload a private source resume before review.</InlineAlert>}
      {file && !priorReview && <InlineAlert variant="information">This source resume still needs administrator review. Existing canonical profile facts remain unchanged until selected proposals are confirmed.</InlineAlert>}
      {extraction.failureReason && <InlineAlert variant="warning">Extraction stopped: {extraction.failureReason}. No profile data was changed.</InlineAlert>}
      {extraction.warnings.map((warning, index) => <InlineAlert key={`${warning.code}-${index}`} variant="warning">{warning.message}</InlineAlert>)}
    </SectionCard>
    <SectionCard title="Extracted source text" description="Read-only normalized text; not the canonical profile.">
      <pre className="extraction-test-preview" aria-label="Extracted source resume text">{extraction.normalizedText?.slice(0, 100_000) ?? "No extractable text is available."}</pre>
      {extraction.normalizedText && extraction.normalizedText.length > 100_000 &&
        <p className="type-supporting text-text-muted">Preview limited to the first 100,000 characters. Proposals use the complete extracted text.</p>}
    </SectionCard>
    <SectionCard title="Structured proposals" description="Conservative rules leave ambiguous content unresolved for manual review.">
      {draft.warnings.map((warning, index) => <InlineAlert key={index} variant="warning">{warning}</InlineAlert>)}
      {priorReview ? <InlineAlert variant="information">This source file was already confirmed. Upload a replacement for a new import.</InlineAlert> :
        extraction.status === "success" && sourceHash ? <AdminResumeReviewForm userId={userId} sourceHash={sourceHash} proposals={draft.proposals} /> :
        <p className="type-body">No structured proposals can be confirmed from this extraction.</p>}
    </SectionCard>
    <SectionCard title="Saved canonical summary" description="Existing profile content remains authoritative until an explicitly selected summary is confirmed.">
      <p className="type-body">{canonicalSummary || "No saved professional summary."}</p>
    </SectionCard>
    <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/edit`}>Return to client account</Link>
  </div></div>;
}
