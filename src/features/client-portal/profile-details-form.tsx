"use client";

import { useActionState, useState } from "react";

import { InlineAlert, SelectField, TextInput } from "@/components/ui";

import type { ClientProfileDetails } from "./profile-details-service";
import { initialProfileDetailsActionState } from "./profile-details-types";
import { saveProfileDetailsAction } from "./save-profile-details-action";
import { TARGET_MARKET_LABELS } from "./target-market-labels";

export function ProfileDetailsForm({ details }: { details: ClientProfileDetails }) {
  const [state, formAction, isPending] = useActionState(
    saveProfileDetailsAction,
    initialProfileDetailsActionState,
  );
  const [linkedinUrl, setLinkedinUrl] = useState(details.linkedinUrl);
  const [currentLocation, setCurrentLocation] = useState(details.currentLocation);
  const [relocationPreference, setRelocationPreference] = useState(
    details.relocationPreference,
  );
  const selectedPackage = details.packages.find(
    (option) => option.code === details.selectedPackageCode,
  );

  return (
    <form action={formAction} className="client-contact-form" noValidate>
      {state.status === "success" ? (
        <InlineAlert variant="success">{state.message}</InlineAlert>
      ) : state.message ? (
        <InlineAlert variant="error">{state.message}</InlineAlert>
      ) : null}

      <div className="client-profile-details-grid">
        <TextInput
          autoComplete="url"
          error={state.errors?.linkedinUrl}
          helperText="Optional. Use your personal LinkedIn profile URL (linkedin.com/in/...)."
          id="profile-linkedin-url"
          label="LinkedIn profile URL"
          maxLength={2048}
          name="linkedinUrl"
          onChange={(event) => setLinkedinUrl(event.target.value)}
          placeholder="https://www.linkedin.com/in/your-name"
          type="url"
          value={linkedinUrl}
        />
        <TextInput
          autoComplete="address-level2"
          error={state.errors?.currentLocation}
          helperText="City and country, for example Kolkata, India."
          id="profile-current-location"
          label="Current location"
          maxLength={160}
          name="currentLocation"
          onChange={(event) => setCurrentLocation(event.target.value)}
          required
          value={currentLocation}
        />
        <SelectField
          error={state.errors?.relocationPreference}
          helperText="Tell Zevantaa whether you would consider relocating."
          id="profile-relocation-preference"
          label="Relocation preference"
          name="relocationPreference"
          onChange={(event) =>
            setRelocationPreference(
              event.target.value as ClientProfileDetails["relocationPreference"],
            )
          }
          required
          value={relocationPreference}
        >
          <option value="not-specified">Not specified yet</option>
          <option value="open">Open to relocation</option>
          <option value="conditional">Open under certain conditions</option>
          <option value="not-open">Not open to relocation</option>
        </SelectField>
        <SelectField
          disabled
          helperText="Zevantaa assigns packages. Ask the administrator if you need a change."
          id="profile-selected-package"
          label="Assigned package / target market"
          value={details.selectedPackageCode}
        >
          {!selectedPackage ? (
            <option value={details.selectedPackageCode}>
              {details.selectedPackageCode} (contact Zevantaa)
            </option>
          ) : null}
          {details.packages.map((option) => (
            <option key={option.code} value={option.code}>
              {option.displayName}{option.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </SelectField>
      </div>

      {selectedPackage ? (
        <p className="type-supporting text-text-muted client-package-markets">
          Target markets for this package: {selectedPackage.targetMarkets.map(
            (market) => TARGET_MARKET_LABELS[market],
          ).join(" · ")}
        </p>
      ) : null}
      {selectedPackage && !selectedPackage.isActive ? (
        <InlineAlert variant="warning">
          Your assigned package is currently inactive. Contact Zevantaa about its status.
        </InlineAlert>
      ) : null}

      <div className="client-contact-actions">
        <p className="type-supporting text-text-muted">
          Package and target-market changes are managed by Zevantaa administrators.
        </p>
        <button className="type-button auth-submit" disabled={isPending} type="submit">
          {isPending ? "Saving details…" : "Save link & mobility"}
        </button>
      </div>
    </form>
  );
}
