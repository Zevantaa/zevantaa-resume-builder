"use client";

import { useActionState, useState } from "react";

import { InlineAlert, SelectField, TextInput } from "@/components/ui";

import type { CandidateAccountOption } from "./client-account-types";
import { initialClientAccountFormState } from "./client-account-types";
import { createClientAccountAction } from "./create-client-account-action";

export function ClientAccountForm({ candidates }: { candidates: CandidateAccountOption[] }) {
  const [state, formAction, isPending] = useActionState(
    createClientAccountAction,
    initialClientAccountFormState,
  );
  const [candidateId, setCandidateId] = useState("");
  const [credentialMode, setCredentialMode] = useState("generated");
  const selectedCandidate = candidates.find(({ id }) => id === candidateId);

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
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name} ({candidate.email})
          </option>
        ))}
      </SelectField>

      <TextInput
        autoComplete="off"
        error={state.fieldErrors?.email}
        helperText="Uses the selected candidate profile's primary email."
        id="client-email"
        label="Client email"
        name="email"
        readOnly
        required
        type="email"
        value={selectedCandidate?.email ?? ""}
      />

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
        disabled={isPending || candidates.length === 0}
        type="submit"
      >
        {isPending ? "Creating account…" : "Create client account"}
      </button>
    </form>
  );
}
