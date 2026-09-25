"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui";

import { signOut } from "./auth-service";
import type { AuthPortalIntent } from "./types";

export function LogoutButton({ portal }: { portal: AuthPortalIntent }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setErrorMessage(undefined);
    setIsSigningOut(true);

    try {
      const { redirectTo } = await signOut(portal);
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not sign you out. Please try again.",
      );
      setIsSigningOut(false);
    }
  }

  return (
    <div className="portal-auth-actions">
      {errorMessage ? (
        <InlineAlert variant="error">{errorMessage}</InlineAlert>
      ) : null}
      <button
        className="type-button auth-secondary-button"
        disabled={isSigningOut}
        onClick={handleSignOut}
        type="button"
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
