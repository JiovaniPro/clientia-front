"use client";

import { Archive, Building2, ChevronsUpDown, KeyRound, LayoutDashboard, LogOut, Menu, ShieldCheck, UserCog, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/cn";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Correspondance exacte (l'accueil) plutôt que par préfixe. */
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/platform", label: "Accueil", icon: LayoutDashboard, exact: true },
  { href: "/platform/organizations", label: "Organisations", icon: Building2 },
  { href: "/platform/organizations/deleted", label: "Supprimées", icon: Archive, exact: true },
];

/** L'élément actif est le plus spécifique : « Supprimées » ne rallume pas « Organisations ». */
function activeHref(pathname: string) {
  return NAV_ITEMS.filter((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .map((item) => item.href)
    .sort((a, b) => b.length - a.length)[0];
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const current = activeHref(pathname);
  return (
    <ul className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === current;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                isActive ? "bg-forest-50 font-semibold text-forest-600" : "font-medium text-ink-muted hover:bg-surface-subtle hover:text-ink",
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.75} aria-hidden className="shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Repère permanent de l'espace : on ne confond jamais la console avec l'espace d'une organisation. */
function ConsoleMark() {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-md bg-terracotta-500/10 px-2 py-1 text-xs font-medium text-ink">
      <ShieldCheck size={14} strokeWidth={1.75} aria-hidden className="text-terracotta-500" />
      Console plateforme
    </p>
  );
}

function AccountMenu({ locked, onLogout }: { locked: boolean; onLogout: () => void }) {
  const { platformAdmin } = usePlatformAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!platformAdmin) return null;
  const displayName = platformAdmin.name?.trim() || platformAdmin.email;
  const initials = (platformAdmin.name?.trim() || platformAdmin.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Compte : ${displayName}`}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
      >
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-surface">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{displayName}</span>
          {platformAdmin.name ? <span className="block truncate text-xs text-ink-muted">{platformAdmin.email}</span> : null}
        </span>
        <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-ink-faint" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Compte"
          className="app-rise absolute bottom-full left-0 right-0 z-40 mb-1.5 rounded-lg border border-border bg-surface p-1 shadow-raised"
        >
          {locked ? null : (
            <>
              <Link href="/platform/account" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <UserCog size={16} aria-hidden className="text-ink-muted" />
                Mon compte
              </Link>
              <Link href="/platform/change-password" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <KeyRound size={16} aria-hidden className="text-ink-muted" />
                Changer le mot de passe
              </Link>
              <div aria-hidden className="my-1 border-t border-border" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className={cn(itemClass, "hover:text-status-danger focus-visible:text-status-danger")}
          >
            <LogOut size={16} aria-hidden className="text-ink-muted" />
            Se déconnecter
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cadre de la console : rail gauche (≥ md) de la même famille que l'app des organisations, barre compacte
 * avec menu repliable en dessous. `locked` (mot de passe à changer) : aucune navigation, seul le compte reste.
 */
export function PlatformShell({ children, locked = false }: { children: ReactNode; locked?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = usePlatformAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/platform/login");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  }

  const homeLink = (
    <Link
      href="/platform"
      aria-label="Console plateforme CLIENTIA — accueil"
      className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
    >
      <Logo className="h-7" priority />
    </Link>
  );

  return (
    <div className="app-type flex h-screen flex-col bg-cream md:flex-row">
      {/* Rail (écrans moyens et larges) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="space-y-3 border-b border-border px-5 pb-4 pt-5">
          {homeLink}
          <ConsoleMark />
        </div>
        <nav aria-label="Navigation de la console" className="flex-1 overflow-y-auto px-2 py-4">
          {locked ? (
            <p className="px-3 text-sm text-ink-muted">Choisissez un nouveau mot de passe pour accéder à la console.</p>
          ) : (
            <NavLinks pathname={pathname} />
          )}
        </nav>
        <div className="border-t border-border p-2">
          <AccountMenu locked={locked} onLogout={() => setShowLogoutConfirm(true)} />
        </div>
      </aside>

      {/* Barre compacte (petits écrans) */}
      <header className="relative z-30 border-b border-border bg-surface md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            {homeLink}
            <span className="hidden sm:block">
              <ConsoleMark />
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="platform-mobile-nav"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            {mobileOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
        </div>
        {mobileOpen ? (
          <div id="platform-mobile-nav" className="app-rise space-y-3 border-t border-border px-2 pb-3 pt-3">
            {locked ? null : (
              <nav aria-label="Navigation de la console">
                <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </nav>
            )}
            <div className="border-t border-border pt-2">
              <AccountMenu locked={locked} onLogout={() => setShowLogoutConfirm(true)} />
            </div>
          </div>
        ) : null}
      </header>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>

      {showLogoutConfirm ? (
        <ConfirmModal
          title="Se déconnecter"
          message="Se déconnecter de la console plateforme ?"
          confirmLabel="Se déconnecter"
          variant="neutral"
          onConfirm={handleLogout}
          onClose={() => setShowLogoutConfirm(false)}
          isConfirming={isLoggingOut}
        />
      ) : null}
    </div>
  );
}
