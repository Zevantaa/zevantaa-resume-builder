"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { InlineAlert, TextInput } from "@/components/ui";

import { updateRecoveryPasswordAction } from "./update-recovery-password-action";
import type { AuthPortalIntent } from "./types";

type ResetPasswordFormProps = {
  canResetPassword: boolean;
  initialError?: string;
  portal: AuthPortalIntent;
};

type PasswordFieldErrors = {
  confirmation?: string;
  password?: string;
};

function validatePasswords(password: string, confirmation: string) {
  const errors: PasswordFieldErrors = {};

  if (!password) {
    errors.password = "Enter a new password.";
  } else if (password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }

  if (!confirmation) {
    errors.confirmation = "Confirm your new password.";
  } else if (password !== confirmation) {
    errors.confirmation = "The passwords do not match.";
  }

  return errors;
}

export function ResetPasswordForm({
  canResetPassword,
  initialError,
  portal,
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});
  const [updateError, setUpdateError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isComplete) return;
    const timeout = window.setTimeout(() => {
      window.location.replace(`/login?portal=${portal}`);
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [isComplete, portal]);

  if (!canResetPassword || initialError) {
    return (
      <div className="auth-form">
        <InlineAlert variant="error">
          This recovery link is invalid or has expired. Request a new link to
          continue.
        </InlineAlert>
        <Link
          className="type-button auth-submit auth-action-link"
          href={`/forgot-password?portal=${portal}`}
        >
          Request a new recovery link
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateError(undefined);

    const errors = validatePasswords(password, confirmation);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updateRecoveryPasswordAction(password);
      setPassword("");
      setConfirmation("");
      setIsComplete(true);
    } catch (error) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : "We could not update your password. Request a new link and try again.",
      );
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div className="auth-form" role="status">
        <InlineAlert variant="success">
          Your password has been updated successfully. Returning to sign in.
        </InlineAlert>
        <Link
          className="type-button auth-submit auth-action-link"
          href={`/login?portal=${portal}`}
        >
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="auth-form"
      aria-busy={isSubmitting}
      noValidate
      onSubmit={handleSubmit}
    >
      {updateError ? (
        <InlineAlert variant="error">{updateError}</InlineAlert>
      ) : null}

      <TextInput
        autoComplete="new-password"
        disabled={isSubmitting}
        error={fieldErrors.password}
        helperText="Use at least 8 characters."
        id="new-password"
        label="New password"
        name="new-password"
        onChange={(event) => {
          setPassword(event.target.value);
          setFieldErrors((current) => ({ ...current, password: undefined }));
          setUpdateError(undefined);
        }}
        required
        type="password"
        value={password}
      />

      <TextInput
        autoComplete="new-password"
        disabled={isSubmitting}
        error={fieldErrors.confirmation}
        id="confirm-new-password"
        label="Confirm new password"
        name="confirm-new-password"
        onChange={(event) => {
          setConfirmation(event.target.value);
          setFieldErrors((current) => ({
            ...current,
            confirmation: undefined,
          }));
          setUpdateError(undefined);
        }}
        required
        type="password"
        value={confirmation}
      />

      <button className="type-button auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Updating password..." : "Set new password"}
      </button>
    </form>
  );
}
