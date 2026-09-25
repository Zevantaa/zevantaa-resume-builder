import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SupabaseConfigurationError } from "@/lib/supabase/config";

import { AUTH_PORTALS } from "./config";
import type {
  AuthServiceErrorCode,
  PasswordSignInCredentials,
  PasswordSignInResult,
} from "./types";

export class AuthServiceError extends Error {
  readonly code: AuthServiceErrorCode;

  constructor(code: AuthServiceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthServiceError";
  }
}

function mapAuthenticationError(code: string | undefined) {
  if (code === "invalid_credentials") {
    return new AuthServiceError(
      "invalid-credentials",
      "The email address or password is incorrect.",
    );
  }

  if (code === "email_not_confirmed") {
    return new AuthServiceError(
      "email-unconfirmed",
      "This account must be confirmed before it can sign in.",
    );
  }

  return new AuthServiceError(
    "authentication",
    "We could not sign you in. Check your details and try again.",
  );
}

export async function signInWithPassword({
  email,
  password,
  portal,
}: PasswordSignInCredentials): Promise<PasswordSignInResult> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw mapAuthenticationError(error.code);
    }

    if (!data.user) {
      throw mapAuthenticationError(undefined);
    }

    // Portal intent controls only the post-login destination. It is not an
    // authorization decision; role enforcement is deliberately deferred.
    return {
      email: data.user.email ?? null,
      portal,
      redirectTo: AUTH_PORTALS[portal].destination,
      userId: data.user.id,
    };
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    if (error instanceof SupabaseConfigurationError) {
      throw new AuthServiceError(
        "configuration",
        "Authentication is not configured. Please contact Zevantaa support.",
      );
    }

    throw mapAuthenticationError(undefined);
  }
}
