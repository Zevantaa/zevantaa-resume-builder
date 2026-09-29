"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui";

import { confirmResumeReviewAction, type ReviewSaveState } from "./confirm-resume-review-action";
import type { ResumeReviewProposal } from "./resume-review-parser";

const initialState: ReviewSaveState = { ok: false, message: "" };

export function AdminResumeReviewForm({ userId, sourceHash, proposals }: {
  userId: string; sourceHash: string; proposals: ResumeReviewProposal[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(confirmResumeReviewAction.bind(null, userId), initialState);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return <form action={action} className="dashboard-section">
    <input type="hidden" name="sourceHash" value={sourceHash} />
    {state.message && <InlineAlert variant={state.ok ? "success" : "error"}>{state.message}</InlineAlert>}
    <p className="type-body text-text-muted">Select only supported facts you have checked against the source text. Edits are administrator-entered facts. Unselected entries are ignored; existing child records are never replaced.</p>
    {proposals.map((proposal) => <fieldset className="resume-review-entry" key={proposal.id}>
      <legend className="type-heading-4">{proposal.section} · source line {proposal.sourceLines.join(", ")}</legend>
      <label className="type-label"><input type="checkbox" name={`accept:${proposal.id}`} /> Accept this entry</label>
      <div className="resume-review-fields">
        {Object.entries(proposal.fields).map(([key, value]) => <label className="form-field" key={key}>
          <span className="type-label form-label">{key.replace(/([A-Z])/g, " $1")}</span>
          {key === "text" ? <textarea className="form-control form-textarea" name={`field:${proposal.id}:${key}`} defaultValue={value} maxLength={5000} />
            : <input className="form-control" name={`field:${proposal.id}:${key}`} defaultValue={value} maxLength={5000} />}
        </label>)}
      </div>
    </fieldset>)}
    <label className="type-body"><input type="checkbox" name="confirmReview" value="yes" required /> I reviewed the selected values and authorize writing them to the canonical candidate profile.</label>
    <button className="auth-submit type-button" type="submit" disabled={pending || proposals.length === 0}>
      {pending ? "Confirming…" : "Confirm and save selected entries"}
    </button>
  </form>;
}
