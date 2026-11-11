"use client";

import { useActionState, useState } from "react";

import { InlineAlert, SelectField } from "@/components/ui";

import type { CandidateAccountOption, PackageAssignmentOption } from "./client-account-types";
import { AdminProfileFields } from "./admin-profile-fields";
import { initialClientAccountFormState } from "./client-account-types";
import { createClientAccountAction } from "./create-client-account-action";

export function ClientAccountForm({ candidates, packages }: { candidates: CandidateAccountOption[]; packages: PackageAssignmentOption[] }) {
  const [state, formAction, isPending] = useActionState(createClientAccountAction, initialClientAccountFormState);
  const [candidateId, setCandidateId] = useState("");
  const selectedCandidate = candidates.find(({ id }) => id === candidateId);
  const defaultProfile = selectedCandidate ?? (candidateId === "new" ? {
    name: "", email: "", mobileNumber: "", whatsappNumber: "", linkedinUrl: "",
    currentLocation: "", relocationPreference: "not-specified", packageCode: "",
  } : null);

  return (
    <form action={formAction} aria-busy={isPending} className="client-account-form">
      {state.status === "success" && state.invitation ? (
        <InlineAlert variant="success">
          <strong>{state.message}</strong>
          <span>Supabase Auth accepted the invitation for delivery. No password is generated, displayed, logged, or shared by this application.</span>
          <span className="credential-result">Email: <code>{state.invitation.email}</code></span>
          <span className="credential-result">Delivery state: <strong>{state.invitation.deliveryStatus}</strong></span>
        </InlineAlert>
      ) : state.status === "error" && state.message ? (
        <InlineAlert variant="error">
          <strong>{state.message}</strong>
          {state.invitation?.deliveryStatus === "failed" && <button
            className="auth-secondary-button type-button" disabled={isPending}
            name="retryInvitationId" type="submit" value={state.invitation.invitationId}
          >{isPending ? "Retrying…" : "Retry failed invitation"}</button>}
        </InlineAlert>
      ) : null}

      <SelectField error={state.fieldErrors?.candidateProfileId} id="candidate-profile"
        label="Client / candidate" name="candidateProfileId"
        onChange={(event) => setCandidateId(event.target.value)} required value={candidateId}>
        <option value="">Select a candidate profile</option>
        <option value="new">Create a new candidate profile</option>
        {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>
          {candidate.name} ({candidate.email})
        </option>)}
      </SelectField>

      {defaultProfile && <AdminProfileFields key={candidateId} packages={packages} errors={state.fieldErrors}
        values={{
          fullName: defaultProfile.name, email: defaultProfile.email,
          mobileNumber: defaultProfile.mobileNumber, whatsappNumber: defaultProfile.whatsappNumber,
          linkedinUrl: defaultProfile.linkedinUrl, currentLocation: defaultProfile.currentLocation,
          relocationPreference: defaultProfile.relocationPreference, packageCode: defaultProfile.packageCode,
        }} />}

      <InlineAlert variant="neutral">
        A one-time password-setup invitation will be sent through Supabase Auth. Production delivery requires transactional SMTP configuration.
      </InlineAlert>

      <SelectField defaultValue="active" error={state.fieldErrors?.accountStatus}
        id="account-status" label="Account status" name="accountStatus" required>
        <option value="active">Active</option>
        <option value="disabled">Disabled</option>
      </SelectField>

      <button className="type-button auth-submit" disabled={isPending || !candidateId} type="submit">
        {isPending ? "Creating account…" : "Create account and send invitation"}
      </button>
    </form>
  );
}
