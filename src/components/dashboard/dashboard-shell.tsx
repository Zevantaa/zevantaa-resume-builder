"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

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
  const [pendingNavigation, setPendingNavigation] = useState<{ from: string; href: string } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pendingHref = pendingNavigation?.from === pathname ? pendingNavigation.href : null;
  const portalLabel = portal === "admin" ? "Administrator" : "Client";
  const activeItem = navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0];

  useEffect(() => {
    let scrollFrame = 0;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function onScroll() {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        setShowScrollTop(window.scrollY > 480);
        scrollFrame = 0;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!pendingNavigation) return;
    const timeout = window.setTimeout(() => setPendingNavigation(null), 12_000);
    return () => window.clearTimeout(timeout);
  }, [pendingNavigation]);

  function beginNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey || href === pathname
    ) return;
    setPendingNavigation({ from: pathname, href });
  }

  return (
    <div aria-busy={pendingHref ? "true" : undefined} className="dashboard-shell">
      <a className="skip-link type-button" href="#main-content">
        Skip to main content
      </a>
      {pendingHref ? (
        <div aria-live="polite" className="dashboard-navigation-progress" role="status">
          <span className="sr-only">Loading {navigation.find((item) => item.href === pendingHref)?.label ?? "page"}.</span>
          <span aria-hidden="true" className="dashboard-navigation-progress__bar" />
        </div>
      ) : null}
      <header className="dashboard-masthead">
        <Link className="dashboard-brand" href={`/${portal}`} onClick={(event) => {
          beginNavigation(event, `/${portal}`);
          setMenuOpen(false);
        }}>
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
                  data-pending={pendingHref === item.href ? "true" : undefined}
                  href={item.href}
                  key={item.href}
                  onClick={(event) => {
                    beginNavigation(event, item.href);
                    setMenuOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  {pendingHref === item.href ? <span aria-hidden="true" className="dashboard-navigation-spinner" /> : null}
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
      <button
        aria-label="Scroll to top"
        className={`dashboard-scroll-top${showScrollTop ? " dashboard-scroll-top--visible" : ""}`}
        onClick={() => window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })}
        tabIndex={showScrollTop ? 0 : -1}
        type="button"
      >
        <span aria-hidden="true">↑</span>
      </button>
    </div>
  );
}
