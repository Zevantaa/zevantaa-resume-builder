"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";

import { FileInput, InlineAlert } from "@/components/ui";
import { isGccPhotoAvailable } from "@/features/document-generation/package-routing";

import type { ClientIntakeFiles } from "./client-intake-service";
import { initialIntakeActionState } from "./client-intake-types";
import type { ClientContactProfile } from "./contact-profile-types";
import { IntakeFileValidationError, validateIntakeFileMetadata } from "./intake-file-validation";
import type { ClientProfileDetails } from "./profile-details-service";
import { saveClientIntakeAction } from "./save-client-intake-action";
import { TARGET_MARKET_LABELS } from "./target-market-labels";

const relocationLabels = {
  "not-specified": "Not specified yet",
  open: "Open to relocation",
  conditional: "Open under certain conditions",
  "not-open": "Not open to relocation",
};

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
  const [selectedResume, setSelectedResume] = useState({ name: "", actionState: state });
  const [selectedPhoto, setSelectedPhoto] = useState({ name: "", actionState: state });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const selectedPackage = details.packages.find((option) => option.code === details.selectedPackageCode);
  const errors = { ...state.errors, ...clientErrors };
  const hasUnsavedSelection = Boolean(selectedResume.name || selectedPhoto.name);
  useEffect(() => {
    if (!hasUnsavedSelection || isPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedSelection, isPending]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const resume = formData.get("resume");
    const photo = formData.get("photo");
    const nextErrors: Record<string, string> = {};
    if ((!files.resume || files.resume.status !== "available") && (!(resume instanceof File) || !resume.name)) {
      nextErrors.resume = "Upload a source resume to continue.";
    } else if (resume instanceof File && resume.name) {
      try {
        validateIntakeFileMetadata(resume, "source-resume");
      } catch (error) {
        nextErrors.resume = error instanceof IntakeFileValidationError ? error.message : "Choose a valid resume.";
      }
    }
    if (photo instanceof File && photo.name) {
      try {
        validateIntakeFileMetadata(photo, "gcc-profile-photo");
      } catch (error) {
        nextErrors.photo = error instanceof IntakeFileValidationError ? error.message : "Choose a valid photograph.";
      }
    }
    if (!(resume instanceof File && resume.name) && !(photo instanceof File && photo.name)) {
      nextErrors.resume ??= "Choose a resume or photograph to upload.";
    }
    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.preventDefault();
      const first = nextErrors.resume ? "profile-resume" : "profile-photo";
      window.requestAnimationFrame(() => document.getElementById(first)?.focus({ preventScroll: false }));
    }
  }

  return (
    <div className="client-contact-form">
      <details className="client-intake-managed-details">
      <summary className="type-button">Review Zevantaa-managed profile details</summary>
      <p className="type-supporting text-text-muted">These details are managed by Zevantaa. Contact the administrator to request a correction.</p>
      <dl className="dashboard-detail-list client-contact-grid">
        <div><dt>Full name</dt><dd>{profile.fullName}</dd></div>
        <div><dt>Primary email / login</dt><dd>{profile.primaryEmail}</dd></div>
        <div><dt>Mobile number</dt><dd>{profile.mobileNumber}</dd></div>
        <div><dt>WhatsApp number</dt><dd>{profile.whatsappNumber || "Not provided"}</dd></div>
        <div><dt>LinkedIn profile</dt><dd>{details.linkedinUrl || "Not provided"}</dd></div>
        <div><dt>Current location</dt><dd>{details.currentLocation}</dd></div>
        <div><dt>Relocation preference</dt><dd>{relocationLabels[details.relocationPreference]}</dd></div>
        <div><dt>Assigned package</dt><dd>{selectedPackage?.displayName ?? details.selectedPackageCode}</dd></div>
      </dl>
      {selectedPackage && <p className="type-supporting text-text-muted client-package-markets">Target markets: {selectedPackage.targetMarkets.map((market) => TARGET_MARKET_LABELS[market]).join(" · ")}</p>}
      {selectedPackage && !selectedPackage.isActive && <InlineAlert variant="warning">Your assigned package is inactive. Contact Zevantaa about its status.</InlineAlert>}
      </details>

      <form action={formAction} aria-busy={isPending} className="client-contact-form" onSubmit={validateBeforeSubmit}>
        <div className="client-profile-section-divider">
          <h2 className="type-heading-3 text-text">Source files</h2>
          <p className="type-supporting text-text-muted">Your uploads remain private. A saved resume is processed automatically; only uncertain details require your input, and ready profiles generate every package-entitled document automatically.</p>
        </div>
        {state.message && <InlineAlert variant={state.status === "success" ? "success" : state.status === "warning" ? "warning" : "error"}>{state.message}</InlineAlert>}
        <div className="client-intake-file-grid">
          <div className="client-intake-file-block">
            <FileInput key={`resume-${state.savedAt ?? "initial"}`} id="profile-resume" name="resume" label="Existing resume"
              disabled={isPending}
              required={!files.resume || files.resume.status !== "available"}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              helperText="PDF, DOC or DOCX, maximum 10 MB. A replacement becomes current only after a successful private save and requires new administrator review."
              error={errors.resume} onChange={(event) => setSelectedResume({ name: event.target.files?.[0]?.name ?? "", actionState: state })} />
            <p className="type-supporting text-text-muted">{files.resume ? `Current: ${files.resume.originalFileName} (${files.resume.status})` : "No source resume yet. Upload one to begin administrator review."}</p>
            {selectedResume.name && selectedResume.actionState === state && <p aria-live="polite" className="type-supporting client-intake-selection" role="status">Selected replacement: {selectedResume.name}</p>}
          </div>
          {isGccPhotoAvailable(details.selectedPackageCode) && <div className="client-intake-file-block">
            <FileInput key={`photo-${state.savedAt ?? "initial"}`} id="profile-photo" name="photo" label="GCC profile photograph (optional)"
              disabled={isPending}
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              helperText="Mainly for GCC/Middle East applications. JPEG, PNG or WebP, maximum 5 MB. A replacement becomes current only after a successful private save."
              error={errors.photo} onChange={(event) => setSelectedPhoto({ name: event.target.files?.[0]?.name ?? "", actionState: state })} />
            <p className="type-supporting text-text-muted">{files.photo ? `Current: ${files.photo.originalFileName} (${files.photo.status})` : "No photograph uploaded."}</p>
            {selectedPhoto.name && selectedPhoto.actionState === state && <p aria-live="polite" className="type-supporting client-intake-selection" role="status">Selected replacement: {selectedPhoto.name}</p>}
          </div>}
        </div>
        <div className="client-contact-actions">
          <p className="type-supporting text-text-muted">Only selected files will be saved; your administrative profile details cannot be changed here.</p>
          <button className="type-button auth-submit" disabled={isPending} type="submit">{isPending ? "Saving files…" : "Save files"}</button>
        </div>
      </form>
    </div>
  );
}
