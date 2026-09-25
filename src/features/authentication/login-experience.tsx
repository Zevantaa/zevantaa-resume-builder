import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "./login-form";
import { AUTH_PORTALS } from "./config";
import type { AuthPortalIntent } from "./types";

type LoginExperienceProps = {
  portal: AuthPortalIntent;
};

export function LoginExperience({ portal }: LoginExperienceProps) {
  const portalConfiguration = AUTH_PORTALS[portal];

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="login-heading">
        <div className="auth-brand-panel">
          <Link
            aria-label="Zevantaa Careers home"
            className="auth-wordmark"
            href="/"
          >
            <Image
              alt="Zevantaa Careers Private Limited"
              className="auth-logo"
              height={147}
              priority
              src="/branding/zevantaa-logo-reversed.svg"
              unoptimized
              width={220}
            />
          </Link>
          <div className="auth-brand-copy">
            <p className="type-label auth-kicker">Resume Builder</p>
            <h1 className="type-heading-1">
              Structured profiles. Market-ready documents.
            </h1>
            <p className="type-body auth-brand-description">
              Secure access to the Zevantaa multi-market resume workspace.
            </p>
          </div>
          <p className="type-supporting auth-private-note">
            Private portal access for authorised Zevantaa clients and the master
            administrator.
          </p>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-content">
            <header className="auth-form-header">
              <p className="type-label text-text-muted">Secure access</p>
              <h2 className="type-heading-2 text-text" id="login-heading">
                {portalConfiguration.heading}
              </h2>
              <p className="type-body text-text-muted">
                {portalConfiguration.description}
              </p>
            </header>

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
              Accounts are created by Zevantaa. Public registration is not
              available.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
