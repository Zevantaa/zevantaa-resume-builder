import Link from "next/link";

import { AuthExperienceShell } from "./auth-experience-shell";
import { LoginForm } from "./login-form";
import { AUTH_PORTALS } from "./config";
import type { AuthPortalIntent } from "./types";

type LoginExperienceProps = {
  portal: AuthPortalIntent;
};

export function LoginExperience({ portal }: LoginExperienceProps) {
  const portalConfiguration = AUTH_PORTALS[portal];

  return (
    <AuthExperienceShell
      description={portalConfiguration.description}
      eyebrow="Secure access"
      heading={portalConfiguration.heading}
    >
      <nav className="auth-portal-switch" aria-label="Choose portal">
        {(Object.keys(AUTH_PORTALS) as AuthPortalIntent[]).map((intent) => (
          <Link
            aria-current={intent === portal ? "page" : undefined}
            className="type-button auth-portal-option"
            href={`/login?portal=${intent}`}
            key={intent}
          >
            {AUTH_PORTALS[intent].label}
          </Link>
        ))}
      </nav>

      <LoginForm portal={portal} />

      <p className="type-supporting auth-provisioning-note">
        Accounts are created by Zevantaa. Public registration is not available.
      </p>
    </AuthExperienceShell>
  );
}
