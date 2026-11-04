"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui";
import type { ResumeReviewProposal } from "@/features/document-generation/resume-review-parser";

import { confirmCanonicalResumeProfileAction, confirmClientResumeProposalsAction,
  type ClientResumeInputState } from "./confirm-client-resume-input-action";

const initial: ClientResumeInputState = { ok: false, message: "" };

export function ClientResumeProposalForm({ jobId, proposals }: { jobId: string; proposals: ResumeReviewProposal[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(confirmClientResumeProposalsAction, initial);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return <form action={action} className="dashboard-section">
    <input type="hidden" name="jobId" value={jobId} />
    {state.message && <InlineAlert variant={state.ok ? "success" : "error"}>{state.message}</InlineAlert>}
    <p className="type-body text-text-muted">Select only facts you recognize and correct any highlighted value. Unselected entries are ignored; no fact is invented.</p>
    {proposals.map((proposal) => <fieldset className="resume-review-entry" key={proposal.id}>
      <legend className="type-heading-4">{proposal.section} Â· source line {proposal.sourceLines.join(", ")}</legend>
      <label className="type-label"><input type="checkbox" name={`accept:${proposal.id}`} /> Confirm this entry</label>
      <div className="resume-review-fields">{Object.entries(proposal.fields).map(([key, value]) => <label className="form-field" key={key}>
        <span className="type-label form-label">{key.replace(/([A-Z])/g, " $1")}</span>
        {["text", "description", "highlights"].includes(key)
          ? <textarea className="form-control form-textarea" name={`field:${proposal.id}:${key}`} defaultValue={value} maxLength={5000} />
          : <input className="form-control" name={`field:${proposal.id}:${key}`} defaultValue={value} maxLength={5000} />}
      </label>)}</div>
    </fieldset>)}
    <label className="type-body"><input type="checkbox" name="confirmReview" value="yes" required /> I checked the selected details and confirm they are accurate.</label>
    <button className="auth-submit type-button" type="submit" disabled={pending}>{pending ? "Savingâ€¦" : "Save confirmed details"}</button>
  </form>;
}

export function ClientCanonicalProfileConfirmation({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(confirmCanonicalResumeProfileAction, initial);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return <form action={action} className="dashboard-section">
    <input type="hidden" name="jobId" value={jobId} />
    {state.message && <InlineAlert variant={state.ok ? "success" : "error"}>{state.message}</InlineAlert>}
    <label className="type-body"><input type="checkbox" name="confirmCanonical" value="yes" required /> I reviewed my saved career profile and confirm its employment, education, or project facts are complete and accurate.</label>
    <button className="auth-submit type-button" type="submit" disabled={pending}>{pending ? "Checkingâ€¦" : "Confirm saved career profile"}</button>
  </form>;
}
