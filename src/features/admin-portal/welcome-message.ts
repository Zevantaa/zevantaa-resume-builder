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

export function getClientPortalUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      return null;
    }
    return new URL("/login?portal=client", url.origin).toString();
  }
  catch { return null; }
}

export function buildClientWelcomeMessages(input: {
  fullName: string; mobileNumber: string; whatsappNumber: string;
  email: string; packageName: string; portalUrl: string;
}) {
  const lines = [
    `Welcome to Zevantaa Careers, ${input.fullName}.`,
    "",
    "Your secure Zevantaa ATS client account is ready.",
    `Login username: ${input.email}`,
    `Registered mobile: ${input.mobileNumber}`,
    `WhatsApp: ${input.whatsappNumber || "Not provided"}`,
    `Assigned package: ${input.packageName}`,
    `Client portal: ${input.portalUrl}`,
    "",
    "Use the secure invitation or password-setup link shared separately to establish your password. Zevantaa will never send or retain your plaintext password.",
    "After signing in, open Profile to upload your PDF, DOC or DOCX resume. Extraction and entitled document generation continue automatically when the profile is ready.",
  ];
  return {
    complete: lines.join("\n"),
    whatsapp: [
      `Hello ${input.fullName}, welcome to Zevantaa Careers.`,
      `Username: ${input.email}`,
      `Package: ${input.packageName}`,
      `Portal: ${input.portalUrl}`,
      "Please use the secure setup link shared separately, then upload your resume from Profile.",
    ].join("\n"),
  };
}
