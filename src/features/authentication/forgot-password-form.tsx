"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { InlineAlert, TextInput } from "@/components/ui";

import { requestPasswordRecovery } from "./auth-service";
import type { AuthPortalIntent } from "./types";

type ForgotPasswordFormProps = {
  portal: AuthPortalIntent;
};

export function ForgotPasswordForm({ portal }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [requestError, setRequestError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setEmailError("Enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError(undefined);
    setRequestError(undefined);
    setIsSubmitting(true);

    try {
      await requestPasswordRecovery({
        email: normalizedEmail,
        portal,
        redirectOrigin: window.location.origin,
      });
      setIsComplete(true);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "We could not send a recovery email. Please try again shortly.",
      );
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div className="auth-form" role="status">
        <InlineAlert variant="success">
          If an account exists for that address, a password recovery link has
          been sent. Check your inbox and spam folder.
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
      {requestError ? (
        <InlineAlert variant="error">{requestError}</InlineAlert>
      ) : null}

      <TextInput
        autoComplete="email"
        disabled={isSubmitting}
        error={emailError}
        id="recovery-email"
        inputMode="email"
        label="Email address"
        name="email"
        onChange={(event) => {
          setEmail(event.target.value);
          setEmailError(undefined);
          setRequestError(undefined);
        }}
        placeholder="name@example.com"
        required
        type="email"
        value={email}
      />

      <button className="type-button auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending recovery link..." : "Send recovery link"}
      </button>

      <Link
        className="type-supporting auth-text-link auth-centered-link"
        href={`/login?portal=${portal}`}
      >
        Return to sign in
      </Link>
    </form>
  );
}
