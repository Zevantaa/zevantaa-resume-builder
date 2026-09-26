"use client";

import { useActionState, useState } from "react";

import { InlineAlert, TextInput } from "@/components/ui";

import type { ClientContactProfile } from "./contact-profile-types";
import { initialContactProfileActionState } from "./contact-profile-types";
import { saveContactProfileAction } from "./save-contact-profile-action";

export function ContactProfileForm({
  profile,
}: {
  profile: ClientContactProfile;
}) {
  const [state, formAction, isPending] = useActionState(
    saveContactProfileAction,
    initialContactProfileActionState,
  );
  const [fullName, setFullName] = useState(profile.fullName);
  const [primaryEmail, setPrimaryEmail] = useState(profile.primaryEmail);
  const [mobileNumber, setMobileNumber] = useState(profile.mobileNumber);
  const [whatsappNumber, setWhatsAppNumber] = useState(profile.whatsappNumber);
  const [sameAsMobile, setSameAsMobile] = useState(
    Boolean(profile.whatsappNumber) &&
      profile.whatsappNumber === profile.mobileNumber,
  );

  return (
    <form action={formAction} className="client-contact-form" noValidate>
      {state.status === "success" ? (
        <InlineAlert variant="success">{state.message}</InlineAlert>
      ) : state.message ? (
        <InlineAlert variant="error">{state.message}</InlineAlert>
      ) : null}

      <div className="client-contact-grid">
        <TextInput
          autoComplete="name"
          error={state.errors?.fullName}
          id="profile-full-name"
          label="Full name"
          maxLength={120}
          name="fullName"
          onChange={(event) => setFullName(event.target.value)}
          required
          value={fullName}
        />

        <TextInput
          autoComplete="email"
          error={state.errors?.primaryEmail}
          helperText="Your profile contact email. This does not change your login email."
          id="profile-primary-email"
          label="Primary email"
          maxLength={254}
          name="primaryEmail"
          onChange={(event) => setPrimaryEmail(event.target.value)}
          required
          type="email"
          value={primaryEmail}
        />

        <TextInput
          autoComplete="tel"
          error={state.errors?.mobileNumber}
          helperText="Include your country code when applicable, for example +91."
          id="profile-mobile-number"
          inputMode="tel"
          label="Mobile number"
          maxLength={32}
          name="mobileNumber"
          onChange={(event) => setMobileNumber(event.target.value)}
          required
          type="tel"
          value={mobileNumber}
        />

        <div className="client-whatsapp-field">
          <TextInput
            autoComplete="tel"
            disabled={sameAsMobile}
            error={state.errors?.whatsappNumber}
            helperText="Optional. Include the country code if you use a different number."
            id="profile-whatsapp-number"
            inputMode="tel"
            label="WhatsApp number"
            maxLength={32}
            name="whatsappNumber"
            onChange={(event) => setWhatsAppNumber(event.target.value)}
            type="tel"
            value={sameAsMobile ? mobileNumber : whatsappNumber}
          />
          <label className="type-supporting client-same-number" htmlFor="same-as-mobile">
            <input
              checked={sameAsMobile}
              id="same-as-mobile"
              name="sameAsMobile"
              onChange={(event) => setSameAsMobile(event.target.checked)}
              type="checkbox"
            />
            Use my mobile number for WhatsApp
          </label>
        </div>
      </div>

      <div className="client-contact-actions">
        <p className="type-supporting text-text-muted">
          Your contact details are used for your candidate profile.
        </p>
        <button
          className="type-button auth-submit"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving details…" : "Save contact details"}
        </button>
      </div>
    </form>
  );
}
