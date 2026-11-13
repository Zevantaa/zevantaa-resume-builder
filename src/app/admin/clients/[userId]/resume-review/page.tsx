import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAlert, SectionCard, StatusBadge } from "@/components/ui";
import { getAdminResumeReview } from "@/features/document-generation/admin-resume-review-service";

export default async function AdminResumeReviewRoute({ params }: PageProps<"/admin/clients/[userId]/resume-review">) {
  const { userId } = await params;
  const review = await getAdminResumeReview(userId);
  if (!review) notFound();
  const { client, file, extraction, draft, sourceHash, canonicalSummary, priorReview } = review;
  return <div className="dashboard-page"><div className="layout-container-readable layout-stack">
    <header className="layout-stack">
      <p className="type-label text-text-muted">Admin portal · Resume processing support</p>
      <h1 className="type-heading-1">Monitor source resume for {client.fullName}</h1>
      <p className="type-body text-text-muted">Administrators can inspect extraction evidence and assist the client. Only the linked client can confirm extracted facts for automated generation.</p>
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
      {file && !priorReview && <InlineAlert variant="information">This source resume is awaiting client review. Existing canonical profile facts remain unchanged until the client confirms selected proposals.</InlineAlert>}
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
      {priorReview ? <InlineAlert variant="information">This source file was already confirmed.</InlineAlert> :
        extraction.status === "success" && sourceHash
          ? <p className="type-body">{draft.proposals.length} supported proposal(s) are available in the client review screen. Administrator approval is not required or available.</p>
          : <p className="type-body">No structured proposals are available from this extraction.</p>}
    </SectionCard>
    <SectionCard title="Saved canonical summary" description="Existing profile content remains authoritative until an explicitly selected summary is confirmed.">
      <p className="type-body">{canonicalSummary || "No saved professional summary."}</p>
    </SectionCard>
    <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/edit`}>Return to client account</Link>
  </div></div>;
}
