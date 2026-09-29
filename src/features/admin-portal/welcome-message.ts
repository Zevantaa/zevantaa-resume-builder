import "server-only";

import type { AdminProfileFields, ClientAccountStatus } from "./client-account-types";

export function getClientPortalUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      return null;
    }
    return new URL("/login?portal=client", url.origin).toString();
  } catch {
    return null;
  }
}

export function createWelcomeMessage(
  profile: AdminProfileFields,
  temporaryPassword: string,
  portalUrl: string,
  packageName: string,
  accountStatus: ClientAccountStatus,
) {
  const accessLine = accountStatus === "active"
    ? "Your Zevantaa Resume Builder client access is ready."
    : "Your Zevantaa Resume Builder account is prepared. Portal access remains disabled until Zevantaa enables it.";
  const welcomeMessage = [
    `Hello ${profile.fullName},`,
    "",
    accessLine,
    `Login email: ${profile.email}`,
    `Mobile: ${profile.mobileNumber}`,
    `WhatsApp: ${profile.whatsappNumber ?? "Not provided"}`,
    `Assigned package: ${packageName}`,
    `Client portal: ${portalUrl}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    "Please sign in and change your password using the secure account flow.",
  ].join("\n");
  const safeBody = `Hello ${profile.fullName}, ${accessLine} Client portal: ${portalUrl}. Your temporary password will be shared separately through a secure channel.`;
  const emailLink = `mailto:${encodeURIComponent(profile.email)}?subject=${encodeURIComponent("Zevantaa client portal access")}&body=${encodeURIComponent(safeBody)}`;
  const whatsappDigits = profile.whatsappNumber?.replace(/\D/g, "") ?? "";
  const whatsappLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(safeBody)}`
    : null;
  return { welcomeMessage, emailLink, whatsappLink };
}
