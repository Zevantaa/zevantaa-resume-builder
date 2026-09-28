"use client";

import { useActionState, useState, type FormEvent } from "react";

import { FileInput, InlineAlert, SelectField, TextInput } from "@/components/ui";
import type { ClientContactProfile } from "./contact-profile-types";
import type { ClientIntakeFiles } from "./client-intake-service";
import type { ClientProfileDetails } from "./profile-details-service";
import { initialIntakeActionState } from "./client-intake-types";
import { validateContactProfile } from "./contact-profile-validation";
import { IntakeFileValidationError, validateIntakeFileMetadata } from "./intake-file-validation";
import { validateProfileDetails } from "./profile-details-validation";
import { saveClientIntakeAction } from "./save-client-intake-action";
import { TARGET_MARKET_LABELS } from "./target-market-labels";

export function ClientIntakeForm({
  profile,
  details,
  files,
}: {
  profile: ClientContactProfile;
  details: ClientProfileDetails;
  files: ClientIntakeFiles;
}) {
  const [state, formAction, isPending] = useActionState(saveClientIntakeAction, initialIntakeActionState);
  const [fullName, setFullName] = useState(profile.fullName);
  const [primaryEmail, setPrimaryEmail] = useState(profile.primaryEmail);
  const [mobileNumber, setMobileNumber] = useState(profile.mobileNumber);
  const [whatsappNumber, setWhatsAppNumber] = useState(profile.whatsappNumber);
  const [sameAsMobile, setSameAsMobile] = useState(Boolean(profile.whatsappNumber) && profile.whatsappNumber === profile.mobileNumber);
  const [linkedinUrl, setLinkedinUrl] = useState(details.linkedinUrl);
  const [currentLocation, setCurrentLocation] = useState(details.currentLocation);
  const [relocationPreference, setRelocationPreference] = useState(details.relocationPreference);
  const [selectedResume, setSelectedResume] = useState({ name: "", actionState: state });
  const [selectedPhoto, setSelectedPhoto] = useState({ name: "", actionState: state });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const selectedPackage = details.packages.find((option) => option.code === details.selectedPackageCode);
  const fieldErrors = { ...state.errors, ...clientErrors };

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const contact = validateContactProfile({
      fullName: String(formData.get("fullName") ?? ""),
      primaryEmail: String(formData.get("primaryEmail") ?? ""),
      mobileNumber: String(formData.get("mobileNumber") ?? ""),
      whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
      sameAsMobile: formData.get("sameAsMobile") === "on",
    });
    const detailsResult = validateProfileDetails({
      linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
      currentLocation: String(formData.get("currentLocation") ?? ""),
      relocationPreference: String(formData.get("relocationPreference") ?? ""),
    });
    const errors: Record<string, string> = { ...contact.errors, ...detailsResult.errors };
    const resume = formData.get("resume");
    const photo = formData.get("photo");
    if ((!files.resume || files.resume.status !== "available") && (!(resume instanceof File) || !resume.name)) {
      errors.resume = "Upload a source resume to continue.";
    } else if (resume instanceof File && resume.name) {
      try {
        validateIntakeFileMetadata(resume, "source-resume");
      } catch (error) {
        errors.resume = error instanceof IntakeFileValidationError ? error.message : "Choose a valid resume.";
      }
    }
    if (photo instanceof File && photo.name) {
      try {
        validateIntakeFileMetadata(photo, "gcc-profile-photo");
      } catch (error) {
        errors.photo = error instanceof IntakeFileValidationError ? error.message : "Choose a valid photograph.";
      }
    }
    setClientErrors(errors);
    if (Object.keys(errors).length) event.preventDefault();
  }

  return (
    <form action={formAction} className="client-contact-form" noValidate onSubmit={validateBeforeSubmit}>
      {state.message ? <InlineAlert variant={state.status === "success" ? "success" : state.status === "warning" ? "warning" : "error"}>{state.message}</InlineAlert> : null}

      <div className="client-contact-grid">
        <TextInput id="profile-full-name" name="fullName" label="Full name" required autoComplete="name" maxLength={120}
          value={fullName} onChange={(event) => setFullName(event.target.value)} error={fieldErrors.fullName} />
        <TextInput id="profile-primary-email" name="primaryEmail" label="Primary email" required type="email" autoComplete="email" maxLength={254}
          helperText="Profile contact email only; your login email does not change." value={primaryEmail}
          onChange={(event) => setPrimaryEmail(event.target.value)} error={fieldErrors.primaryEmail} />
        <TextInput id="profile-mobile-number" name="mobileNumber" label="Mobile number" required type="tel" inputMode="tel" autoComplete="tel" maxLength={32}
          helperText="Include your country code when applicable." value={mobileNumber}
          onChange={(event) => setMobileNumber(event.target.value)} error={fieldErrors.mobileNumber} />
        <div className="client-whatsapp-field">
          <TextInput id="profile-whatsapp-number" name="whatsappNumber" label="WhatsApp number" type="tel" inputMode="tel" autoComplete="tel" maxLength={32}
            helperText="Optional. Use a different international number if needed." disabled={sameAsMobile}
            value={sameAsMobile ? mobileNumber : whatsappNumber}
            onChange={(event) => setWhatsAppNumber(event.target.value)} error={fieldErrors.whatsappNumber} />
          <label className="type-supporting client-same-number" htmlFor="same-as-mobile">
            <input id="same-as-mobile" name="sameAsMobile" type="checkbox" checked={sameAsMobile} onChange={(event) => setSameAsMobile(event.target.checked)} />
            Use my mobile number for WhatsApp
          </label>
        </div>
      </div>

      <div className="client-profile-section-divider">
        <h2 className="type-heading-3 text-text">Professional link & mobility</h2>
        <p className="type-supporting text-text-muted">These details help describe your target market. Zevantaa manages package assignment.</p>
      </div>
      <div className="client-profile-details-grid">
        <TextInput id="profile-linkedin-url" name="linkedinUrl" label="LinkedIn profile URL" type="url" autoComplete="url" maxLength={2048}
          placeholder="https://www.linkedin.com/in/your-name" helperText="Optional personal LinkedIn profile."
          value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} error={fieldErrors.linkedinUrl} />
        <TextInput id="profile-current-location" name="currentLocation" label="Current location" required autoComplete="address-level2" maxLength={160}
          helperText="City and country, for example Kolkata, India." value={currentLocation}
          onChange={(event) => setCurrentLocation(event.target.value)} error={fieldErrors.currentLocation} />
        <SelectField id="profile-relocation-preference" name="relocationPreference" label="Relocation preference" required
          value={relocationPreference} onChange={(event) => setRelocationPreference(event.target.value as ClientProfileDetails["relocationPreference"])}
          error={fieldErrors.relocationPreference}>
          <option value="not-specified">Not specified yet</option>
          <option value="open">Open to relocation</option>
          <option value="conditional">Open under certain conditions</option>
          <option value="not-open">Not open to relocation</option>
        </SelectField>
        <SelectField id="profile-selected-package" label="Assigned package / target market" disabled value={details.selectedPackageCode}
          helperText="Read-only. Contact Zevantaa to request a change.">
          {!selectedPackage ? <option value={details.selectedPackageCode}>{details.selectedPackageCode} (contact Zevantaa)</option> : null}
          {details.packages.map((option) => <option key={option.code} value={option.code}>{option.displayName}{option.isActive ? "" : " (inactive)"}</option>)}
        </SelectField>
      </div>
      {selectedPackage ? <p className="type-supporting text-text-muted client-package-markets">Target markets: {selectedPackage.targetMarkets.map((market) => TARGET_MARKET_LABELS[market]).join(" · ")}</p> : null}
      {selectedPackage && !selectedPackage.isActive ? <InlineAlert variant="warning">Your assigned package is inactive. Contact Zevantaa about its status.</InlineAlert> : null}

      <div className="client-profile-section-divider">
        <h2 className="type-heading-3 text-text">Source files</h2>
        <p className="type-supporting text-text-muted">Private intake files only. Uploading does not parse or generate documents.</p>
      </div>
      <div className="client-intake-file-grid">
        <div className="client-intake-file-block">
          <FileInput key={`resume-${state.savedAt ?? "initial"}`} id="profile-resume" name="resume" label="Existing resume" required={!files.resume || files.resume.status !== "available"}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            helperText="PDF, DOC or DOCX, maximum 10 MB. Choose a new file to replace the current one."
            error={fieldErrors.resume} onChange={(event) => setSelectedResume({ name: event.target.files?.[0]?.name ?? "", actionState: state })} />
          <p className="type-supporting text-text-muted">{files.resume ? `Current: ${files.resume.originalFileName} (${files.resume.status})` : "No resume currently available."}</p>
          {selectedResume.name && selectedResume.actionState === state ? <p className="type-supporting">Selected replacement: {selectedResume.name}</p> : null}
        </div>
        <div className="client-intake-file-block">
          <FileInput key={`photo-${state.savedAt ?? "initial"}`} id="profile-photo" name="photo" label="GCC profile photograph (optional)"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            helperText="Mainly for GCC/Middle East applications. JPEG, PNG or WebP, maximum 5 MB."
            error={fieldErrors.photo} onChange={(event) => setSelectedPhoto({ name: event.target.files?.[0]?.name ?? "", actionState: state })} />
          <p className="type-supporting text-text-muted">{files.photo ? `Current: ${files.photo.originalFileName} (${files.photo.status})` : "No photograph uploaded."}</p>
          {selectedPhoto.name && selectedPhoto.actionState === state ? <p className="type-supporting">Selected replacement: {selectedPhoto.name}</p> : null}
        </div>
      </div>
      <div className="client-contact-actions">
        <p className="type-supporting text-text-muted">One save updates your profile and any selected files. Existing files stay unchanged if no replacement is chosen.</p>
        <button className="type-button auth-submit" disabled={isPending} type="submit">{isPending ? "Saving intake…" : "Save intake"}</button>
      </div>
    </form>
  );
}
