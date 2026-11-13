"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui";
import type { ResumeReviewProposal } from "@/features/document-generation/resume-review-parser";

import { confirmCanonicalResumeProfileAction, confirmClientResumeProposalsAction,
  type ClientResumeInputState } from "./confirm-client-resume-input-action";

const initial: ClientResumeInputState = { ok: false, message: "" };

export function ClientResumeProposalForm({ jobId, proposals, proposalStates, profile }: {
  jobId: string; proposals: ResumeReviewProposal[];
  proposalStates: Record<string, "new" | "already-saved" | "conflict">;
  profile: {
    fullName: string; primaryEmail: string; mobileNumber: string; whatsappNumber: string;
    linkedinUrl: string; currentLocation: string;
    relocationPreference: "open" | "not-open" | "conditional" | "not-specified";
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(confirmClientResumeProposalsAction, initial);
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return <form action={action} className="dashboard-section">
    <input type="hidden" name="jobId" value={jobId} />
    {state.message && <InlineAlert variant={state.ok ? "success" : "error"}>{state.message}</InlineAlert>}
    <p className="type-body text-text-muted">Select only facts you recognize and correct any highlighted value. Unselected entries are ignored; no fact is invented.</p>
    <fieldset className="resume-review-entry">
      <legend className="type-heading-4">Personal and contact details</legend>
      <p className="type-supporting text-text-muted">Confirm the details used across every document. Your sign-in email is shown read-only; contact Zevantaa support to change the Auth-linked address.</p>
      <div className="resume-review-fields">
        <label className="form-field"><span className="type-label form-label">Full name</span><input className="form-control" defaultValue={profile.fullName} maxLength={160} name="profile:fullName" required /></label>
        <label className="form-field"><span className="type-label form-label">Sign-in email</span><input className="form-control" readOnly value={profile.primaryEmail} /></label>
        <label className="form-field"><span className="type-label form-label">Mobile number</span><input className="form-control" defaultValue={profile.mobileNumber} maxLength={40} name="profile:mobileNumber" required /></label>
        <label className="form-field"><span className="type-label form-label">WhatsApp number</span><input className="form-control" defaultValue={profile.whatsappNumber} maxLength={40} name="profile:whatsappNumber" /></label>
        <label className="form-field"><span className="type-label form-label">LinkedIn URL</span><input className="form-control" defaultValue={profile.linkedinUrl} maxLength={500} name="profile:linkedinUrl" placeholder="https://www.linkedin.com/in/..." type="url" /></label>
        <label className="form-field"><span className="type-label form-label">Current location</span><input className="form-control" defaultValue={profile.currentLocation} maxLength={200} name="profile:currentLocation" required /></label>
        <label className="form-field"><span className="type-label form-label">Relocation preference</span><select className="form-control" defaultValue={profile.relocationPreference} name="profile:relocationPreference" required>
          <option value="not-specified">Not specified</option><option value="open">Open</option><option value="conditional">Conditional</option><option value="not-open">Not open</option>
        </select></label>
      </div>
    </fieldset>
    {proposals.map((proposal) => <fieldset className="resume-review-entry" key={proposal.id}>
      <legend className="type-heading-4">{proposal.section}: source line {proposal.sourceLines.join(", ")}</legend>
      {proposalStates[proposal.id] === "conflict" && <InlineAlert variant="warning">This appears to conflict with a previously confirmed {proposal.section} entry. Leave it unselected to preserve the saved fact, or correct and confirm it as an additional entry.</InlineAlert>}
      {proposalStates[proposal.id] === "already-saved" && <InlineAlert variant="information">This fact already exists in your saved structured profile and will not be duplicated.</InlineAlert>}
      <label className="type-label"><input disabled={proposalStates[proposal.id] === "already-saved"} type="checkbox" name={`accept:${proposal.id}`} /> Confirm this entry</label>
      <div className="resume-review-fields">{Object.entries(proposal.fields).map(([key, value]) => <label className="form-field" key={key}>
        <span className="type-label form-label">{key.replace(/([A-Z])/g, " $1")}</span>
        {["text", "description", "highlights"].includes(key)
          ? <textarea className="form-control form-textarea" name={`field:${proposal.id}:${key}`} defaultValue={value} maxLength={5000} />
          : <input className="form-control" name={`field:${proposal.id}:${key}`} defaultValue={value} maxLength={5000} />}
      </label>)}</div>
    </fieldset>)}
    <label className="type-body"><input type="checkbox" name="confirmReview" value="yes" required /> I checked the selected details and confirm they are accurate.</label>
    <button className="auth-submit type-button" type="submit" disabled={pending}>{pending ? "Saving..." : "Save confirmed details"}</button>
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
    <button className="auth-submit type-button" type="submit" disabled={pending}>{pending ? "Checking..." : "Confirm saved career profile"}</button>
  </form>;
}
