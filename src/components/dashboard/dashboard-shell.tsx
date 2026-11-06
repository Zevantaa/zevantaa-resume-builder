"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { LogoutButton } from "@/features/authentication";
import type { AuthPortalIntent } from "@/features/authentication/types";

export type DashboardNavigationItem = {
  href: string;
  label: string;
  note?: string;
};

type DashboardShellProps = {
  children: ReactNode;
  navigation: readonly DashboardNavigationItem[];
  portal: AuthPortalIntent;
  logoSrc?: string;
};

export function DashboardShell({ children, navigation, portal, logoSrc = "/branding/zevantaa-logo-reversed.svg" }: DashboardShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const portalLabel = portal === "admin" ? "Administrator" : "Client";
  const activeItem = navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0];

  return (
    <div className="dashboard-shell">
      <a className="skip-link type-button" href="#main-content">
        Skip to main content
      </a>
      <header className="dashboard-masthead">
        <Link className="dashboard-brand" href={`/${portal}`} onClick={() => setMenuOpen(false)}>
          <Image
            alt="Zevantaa Careers Private Limited"
            className="dashboard-brand-logo"
            height={147}
            priority
            src={logoSrc}
            unoptimized
            width={220}
          />
          <span className="type-label dashboard-brand-caption">Resume Builder</span>
        </Link>
        <div className="dashboard-masthead-actions">
          <span className="type-label dashboard-portal-identity">{portalLabel} portal</span>
          <button
            aria-controls="dashboard-sidebar"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            className="dashboard-menu-toggle type-button"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
          <div className="dashboard-account-actions"><LogoutButton portal={portal} /></div>
        </div>
      </header>
      <aside className={`dashboard-sidebar${menuOpen ? " dashboard-sidebar--open" : ""}`} id="dashboard-sidebar">
        <div className="dashboard-sidebar-group">
          <nav aria-label={`${portalLabel} navigation`} className="dashboard-navigation">
            {navigation.map((item) => {
              const isActive = item.href === activeItem?.href;
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className="dashboard-navigation-link"
                  href={item.href}
                  key={item.href}
                  onClick={() => setMenuOpen(false)}
                >
                  <span>{item.label}</span>
                  {item.note ? <small>{item.note}</small> : null}
                </Link>
              );
            })}
          </nav>
        </div>

      </aside>

      <div className="dashboard-main-column">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-title">
            <span className="type-label dashboard-topbar-eyebrow">Zevantaa workspace</span>
            <span className="type-button">{activeItem?.label ?? "Overview"}</span>
          </div>
          <span className="type-supporting dashboard-topbar-context">Private {portalLabel.toLowerCase()} access</span>
        </header>
        <main className="dashboard-content" id="main-content">
          <div className="dashboard-route-frame" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
