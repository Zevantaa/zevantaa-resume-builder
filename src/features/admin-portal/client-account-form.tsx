"use client";

import { useActionState, useState } from "react";

import { InlineAlert, SelectField, TextInput } from "@/components/ui";

import type { CandidateAccountOption, PackageAssignmentOption } from "./client-account-types";
import { AdminProfileFields } from "./admin-profile-fields";
import { initialClientAccountFormState } from "./client-account-types";
import { createClientAccountAction } from "./create-client-account-action";

export function ClientAccountForm({ candidates, packages }: { candidates: CandidateAccountOption[]; packages: PackageAssignmentOption[] }) {
  const [state, formAction, isPending] = useActionState(
    createClientAccountAction,
    initialClientAccountFormState,
  );
  const [candidateId, setCandidateId] = useState("");
  const [credentialMode, setCredentialMode] = useState("generated");
  const [copyStatus, setCopyStatus] = useState("");
  const selectedCandidate = candidates.find(({ id }) => id === candidateId);
  const defaultProfile = selectedCandidate ?? (candidateId === "new" ? {
    name: "", email: "", mobileNumber: "", whatsappNumber: "", linkedinUrl: "",
    currentLocation: "", relocationPreference: "not-specified", packageCode: "",
  } : null);

  return (
    <form action={formAction} className="client-account-form">
      {state.status === "success" && state.credentials ? (
        <InlineAlert variant="success">
          <strong>{state.message}</strong>
          <span>
            Share these credentials securely. The temporary password is shown
            only in this result and cannot be retrieved later.
          </span>
          <span className="credential-result">
            Email: <code>{state.credentials.email}</code>
          </span>
          <span className="credential-result">
            Temporary password: <code>{state.credentials.temporaryPassword}</code>
          </span>
          <span>Copy the full message only to a secure channel. Email and WhatsApp links deliberately omit the password.</span>
          <textarea aria-label="Welcome message" className="form-control credential-message" readOnly value={state.credentials.welcomeMessage} />
          <button className="auth-secondary-button type-button" type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.credentials!.welcomeMessage);
              setCopyStatus("Welcome message copied. Treat the clipboard as sensitive.");
            } catch {
              setCopyStatus("Copy failed. Select the message text manually.");
            }
          }}>Copy welcome message</button>
          <span role="status">{copyStatus}</span>
          <a className="auth-text-link" href={state.credentials.emailLink}>Open manual email draft (no password)</a>
          {state.credentials.whatsappLink && <a className="auth-text-link" href={state.credentials.whatsappLink} target="_blank" rel="noopener noreferrer">Open manual WhatsApp draft (no password)</a>}
        </InlineAlert>
      ) : state.status === "error" && state.message ? (
        <InlineAlert variant="error">{state.message}</InlineAlert>
      ) : null}

      <SelectField
        error={state.fieldErrors?.candidateProfileId}
        id="candidate-profile"
        label="Client / candidate"
        name="candidateProfileId"
        onChange={(event) => setCandidateId(event.target.value)}
        required
        value={candidateId}
      >
        <option value="">Select a candidate profile</option>
        <option value="new">Create a new candidate profile</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name} ({candidate.email})
          </option>
        ))}
      </SelectField>

      {defaultProfile && (
        <AdminProfileFields key={candidateId} packages={packages} errors={state.fieldErrors}
          values={{
            fullName: defaultProfile.name,
            email: defaultProfile.email,
            mobileNumber: defaultProfile.mobileNumber,
            whatsappNumber: defaultProfile.whatsappNumber,
            linkedinUrl: defaultProfile.linkedinUrl,
            currentLocation: defaultProfile.currentLocation,
            relocationPreference: defaultProfile.relocationPreference,
            packageCode: defaultProfile.packageCode,
          }} />
      )}

      <SelectField
        id="credential-mode"
        label="Temporary credential"
        name="credentialMode"
        onChange={(event) => setCredentialMode(event.target.value)}
        required
        value={credentialMode}
      >
        <option value="generated">Generate a secure temporary password</option>
        <option value="manual">Enter a temporary password</option>
      </SelectField>

      {credentialMode === "manual" ? (
        <TextInput
          autoComplete="new-password"
          error={state.fieldErrors?.temporaryPassword}
          helperText="At least 12 characters with uppercase, lowercase, number and symbol."
          id="temporary-password"
          label="Temporary password"
          minLength={12}
          name="temporaryPassword"
          required
          type="password"
        />
      ) : null}

      <SelectField
        defaultValue="active"
        error={state.fieldErrors?.accountStatus}
        id="account-status"
        label="Account status"
        name="accountStatus"
        required
      >
        <option value="active">Active</option>
        <option value="disabled">Disabled</option>
      </SelectField>

      <button
        className="type-button auth-submit"
        disabled={isPending || !candidateId}
        type="submit"
      >
        {isPending ? "Creating account…" : "Create client account"}
      </button>
    </form>
  );
}
