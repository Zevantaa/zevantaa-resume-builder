import "server-only";

export function getClientInvitationRedirectUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      return null;
    }
    return new URL("/auth/callback?portal=client&intent=invite", url.origin).toString();
  } catch {
    return null;
  }
}
