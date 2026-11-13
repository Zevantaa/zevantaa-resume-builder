import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SupabaseConfigurationError } from "@/lib/supabase/config";

import { AUTH_PORTALS } from "./config";
import { getCanonicalRecoveryOrigin } from "./recovery-origin";
import type {
  AuthServiceErrorCode,
  AuthPortalIntent,
  PasswordRecoveryRequest,
  PasswordSignInCredentials,
  PasswordSignInResult,
  PasswordUpdateRequest,
  SignOutResult,
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
  if (code === "invalid_credentials" || code === "email_not_confirmed") {
    return new AuthServiceError(
      "invalid-credentials",
      "The email address or password is incorrect.",
    );
  }

  return new AuthServiceError(
    "authentication",
    "The email address or password is incorrect.",
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

    // Portal intent controls only the post-login destination. Server layouts
    // independently verify the database-backed role before rendering.
    return {
      email: data.user.email ?? null,
      portal,
      redirectTo: portal === "client" && data.user.app_metadata?.must_change_password === true
        ? "/change-password"
        : AUTH_PORTALS[portal].destination,
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

export async function requestPasswordRecovery({
  email,
  portal,
}: PasswordRecoveryRequest) {
  try {
    const origin = getCanonicalRecoveryOrigin(
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NODE_ENV === "production",
    );
    if (!origin) {
      throw new AuthServiceError(
        "configuration",
        "Password recovery is not configured. Please contact Zevantaa support.",
      );
    }
    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("portal", portal);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl.toString(),
    });

    if (error) {
      throw new AuthServiceError(
        "password-recovery",
        "We could not send a recovery email. Please try again shortly.",
      );
    }
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    if (error instanceof SupabaseConfigurationError) {
      throw new AuthServiceError(
        "configuration",
        "Password recovery is not configured. Please contact Zevantaa support.",
      );
    }

    throw new AuthServiceError(
      "password-recovery",
      "We could not send a recovery email. Please try again shortly.",
    );
  }
}

export async function updatePassword({ password }: PasswordUpdateRequest) {
  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      throw new AuthServiceError(
        "password-update",
        "We could not update your password. Request a new recovery link and try again.",
      );
    }
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    if (error instanceof SupabaseConfigurationError) {
      throw new AuthServiceError(
        "configuration",
        "Password recovery is not configured. Please contact Zevantaa support.",
      );
    }

    throw new AuthServiceError(
      "password-update",
      "We could not update your password. Request a new recovery link and try again.",
    );
  }
}

export async function signOut(
  portal: AuthPortalIntent,
): Promise<SignOutResult> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      throw new AuthServiceError(
        "sign-out",
        "We could not sign you out. Please try again.",
      );
    }

    return { redirectTo: `/login?portal=${portal}` };
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

    throw new AuthServiceError(
      "sign-out",
      "We could not sign you out. Please try again.",
    );
  }
}
