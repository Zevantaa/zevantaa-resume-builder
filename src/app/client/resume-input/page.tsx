import Link from "next/link";

import { InlineAlert, SectionCard } from "@/components/ui";
import { ClientCanonicalProfileConfirmation, ClientResumeProposalForm } from "@/features/client-portal/client-resume-input-forms";
import { getClientResumeInputReview } from "@/features/client-portal/client-resume-input-service";

export const dynamic = "force-dynamic";

export default async function ClientResumeInputPage() {
  const review = await getClientResumeInputReview();
  return <div className="dashboard-page"><div className="layout-container-readable layout-stack">
    <header className="layout-stack">
      <p className="type-label dashboard-kicker">Client portal: Resume input</p>
      <h1 className="type-heading-1">Review only the details that need your input</h1>
      <p className="type-body text-text-muted">Zevantaa could not safely resolve every required career fact. Confirm or correct only information you can verify.</p>
    </header>
    {!review ? <InlineAlert variant="information">There is no current resume input request. Processing may still be running, or your profile is already ready.</InlineAlert> : <>
      <SectionCard title="Why input is needed" description="These findings contain no private resume text.">
        {review.findings.map((finding) => <InlineAlert key={finding.code} variant="warning">{finding.message}</InlineAlert>)}
      </SectionCard>
      {review.proposals.length > 0 && <SectionCard title="Supported extracted details" description="Choose and correct only entries you recognize.">
        <ClientResumeProposalForm jobId={review.jobId} proposals={review.proposals} />
      </SectionCard>}
      <SectionCard title="Use your saved structured profile" description="Use this when you entered or corrected the facts in the full career editor.">
        <p className="type-body">First update your career profile, then return here and confirm it. At least one verified employment, education, or project entry is required.</p>
        <Link className="type-button dashboard-primary-link" href="/client/career-profile">Update Career Profile</Link>
        <ClientCanonicalProfileConfirmation jobId={review.jobId} />
      </SectionCard>
    </>}
    <Link className="type-button dashboard-text-link" href="/client">Return to overview</Link>
  </div></div>;
}
