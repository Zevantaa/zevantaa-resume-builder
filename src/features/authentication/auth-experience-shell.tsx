import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthExperienceShellProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  heading: string;
};

export function AuthExperienceShell({
  children,
  description,
  eyebrow,
  heading,
}: AuthExperienceShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="auth-heading">
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
              src="/branding/current/logo"
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
              <p className="type-label text-text-muted">{eyebrow}</p>
              <h2 className="type-heading-2 text-text" id="auth-heading">
                {heading}
              </h2>
              <p className="type-body text-text-muted">{description}</p>
            </header>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
