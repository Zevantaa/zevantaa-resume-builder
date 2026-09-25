"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { InlineAlert, TextInput } from "@/components/ui";

import { signInWithPassword } from "./auth-service";
import { AUTH_PORTALS } from "./config";
import type { AuthPortalIntent } from "./types";

type LoginFormProps = {
  portal: AuthPortalIntent;
};

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

function validateCredentials(email: string, password: string) {
  const errors: LoginFieldErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Enter your password.";
  }

  return errors;
}

export function LoginForm({ portal }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [authenticationError, setAuthenticationError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const portalConfiguration = AUTH_PORTALS[portal];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthenticationError(undefined);

    const errors = validateCredentials(email, password);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signInWithPassword({
        email: email.trim(),
        password,
        portal,
      });

      router.replace(result.redirectTo);
      router.refresh();
    } catch (error) {
      setAuthenticationError(
        error instanceof Error
          ? error.message
          : "We could not sign you in. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="auth-form"
      aria-busy={isSubmitting}
      noValidate
      onSubmit={handleSubmit}
    >
      {authenticationError ? (
        <InlineAlert variant="error">{authenticationError}</InlineAlert>
      ) : null}

      <TextInput
        autoComplete="email"
        disabled={isSubmitting}
        error={fieldErrors.email}
        id={`${portal}-email`}
        inputMode="email"
        label="Email address"
        name="email"
        onChange={(event) => {
          setEmail(event.target.value);
          setFieldErrors((current) => ({ ...current, email: undefined }));
          setAuthenticationError(undefined);
        }}
        placeholder="name@example.com"
        required
        type="email"
        value={email}
      />

      <TextInput
        autoComplete="current-password"
        disabled={isSubmitting}
        error={fieldErrors.password}
        id={`${portal}-password`}
        label="Password"
        name="password"
        onChange={(event) => {
          setPassword(event.target.value);
          setFieldErrors((current) => ({ ...current, password: undefined }));
          setAuthenticationError(undefined);
        }}
        required
        type="password"
        value={password}
      />

      <button className="type-button auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting
          ? "Signing in..."
          : `Sign in to ${portalConfiguration.label.toLowerCase()} portal`}
      </button>
    </form>
  );
}
