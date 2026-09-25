import type { AuthPortalIntent } from "./types";

type AuthPortalConfiguration = {
  description: string;
  destination: "/admin" | "/client";
  heading: string;
  label: string;
};

export const AUTH_PORTALS = {
  admin: {
    description: "Secure access for the Zevantaa master administrator.",
    destination: "/admin",
    heading: "Administrator sign in",
    label: "Administrator",
  },
  client: {
    description: "Access your Zevantaa resume builder workspace.",
    destination: "/client",
    heading: "Client sign in",
    label: "Client",
  },
} as const satisfies Record<AuthPortalIntent, AuthPortalConfiguration>;

export function getAuthPortalIntent(value: string | string[] | undefined) {
  return value === "admin" ? "admin" : "client";
}
