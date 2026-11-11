import "server-only";

function getClientCallbackUrl(intent: "invite" | "recovery"): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      return null;
    }
    return new URL(intent === "invite"
      ? "/auth/callback?portal=client&intent=invite"
      : "/auth/callback?portal=client", url.origin).toString();
  } catch {
    return null;
  }
}

export function getClientInvitationRedirectUrl(): string | null {
  return getClientCallbackUrl("invite");
}

export function getClientRecoveryRedirectUrl(): string | null {
  return getClientCallbackUrl("recovery");
}
