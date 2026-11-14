"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import { isDarkTheme, setDarkTheme } from "@/lib/theme";

/** Ancres internes de la landing (défilement doux : globals.css, marqueur data-landing). */
export const LANDING_NAV = [
  { href: "#parcours", label: "Parcours" },
  { href: "#roles", label: "Rôles" },
  { href: "#configuration", label: "Configuration" },
  { href: "#questions", label: "Questions" },
  { href: "#contact", label: "Contact" },
] as const;

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** Interrupteur clair/sombre : classe `.dark` de <html>, choix mémorisé (lib/theme.ts). */
function ThemeSwitch({ onDeep }: { onDeep: boolean }) {
  const [dark, setDark] = useState(isDarkTheme);

  function toggle() {
    const next = !dark;
    setDarkTheme(next);
    setDark(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Mode sombre"
      onClick={toggle}
      className={cn(
        "relative inline-flex h-8 w-[3.75rem] shrink-0 items-center rounded-full border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        onDeep
          ? "border-[var(--lp-on-deep-line)] bg-[var(--lp-deep-raise)] text-[var(--lp-on-deep-muted)] focus-visible:ring-[var(--lp-on-deep)] focus-visible:ring-offset-[var(--lp-deep)]"
          : "border-border bg-surface-subtle text-ink-muted focus-visible:ring-forest-600 focus-visible:ring-offset-cream",
      )}
    >
      <Sun aria-hidden strokeWidth={1.5} className="absolute left-2 h-3.5 w-3.5" />
      <Moon aria-hidden strokeWidth={1.5} className="absolute right-2 h-3.5 w-3.5" />
      <span
        aria-hidden
        className={cn(
          "absolute left-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-300 ease-out",
          onDeep ? "bg-[var(--lp-on-deep)] text-[var(--lp-deep)]" : "bg-forest-600 text-white dark:text-cream",
          dark ? "translate-x-[30px]" : "translate-x-0",
        )}
      >
        {dark ? <Moon strokeWidth={1.5} className="h-3.5 w-3.5" /> : <Sun strokeWidth={1.5} className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

/**
 * En-tête fixe. Posé sur le héros vert profond, il est transparent (logo blanc, texte clair) ;
 * dès que la page défile, il devient une barre pleine aux couleurs du thème. Sous md, les ancres
 * passent dans un panneau ouvert par le bouton menu.
 */
export function LandingHeader() {
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 12,
    () => false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const solid = scrolled || menuOpen;
  const onDeep = false; // ponytail: variante sur fond sombre gardée pour un éventuel héros coloré

  const linkTone = onDeep
    ? "text-[var(--lp-on-deep-muted)] hover:text-[var(--lp-on-deep)] focus-visible:ring-[var(--lp-on-deep)]"
    : "text-ink-muted hover:text-ink focus-visible:ring-forest-600";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 border-b transition-colors duration-300",
        solid ? "border-border bg-cream" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
        <Link
          href="/"
          className={cn(
            "shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2",
            onDeep ? "focus-visible:ring-[var(--lp-on-deep)]" : "focus-visible:ring-forest-600",
          )}
        >
          {onDeep ? (
            <Image src="/brand/logo-full-dark.png" alt="CLIENTIA" width={640} height={194} priority className="h-8 w-auto" />
          ) : (
            <Logo className="h-8" priority />
          )}
        </Link>

        <nav aria-label="Sections de la page" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {LANDING_NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2",
                    linkTone,
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <ThemeSwitch onDeep={onDeep} />
          <Link
            href="/login"
            className={cn("hidden rounded-md px-2 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 sm:inline-flex", linkTone)}
          >
            Connexion
          </Link>
          <a
            href="#contact"
            className="hidden h-9 items-center justify-center rounded-md bg-forest-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream sm:inline-flex dark:text-cream"
          >
            Demander une démo
          </a>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="landing-menu"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 md:hidden",
              onDeep ? "text-[var(--lp-on-deep)] focus-visible:ring-[var(--lp-on-deep)]" : "text-ink focus-visible:ring-forest-600",
            )}
          >
            {menuOpen ? <X aria-hidden strokeWidth={1.5} className="h-5 w-5" /> : <Menu aria-hidden strokeWidth={1.5} className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="landing-menu" aria-label="Sections de la page" className="lp-swap border-t border-border bg-cream px-4 pb-6 pt-2 md:hidden">
          <ul>
            {LANDING_NAV.map((item) => (
              <li key={item.href} className="border-b border-border">
                <a
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block py-4 font-display text-2xl text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            onClick={() => setMenuOpen(false)}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-forest-600 text-sm font-medium text-white dark:text-cream"
          >
            Demander une démo
          </a>
          <Link href="/login" className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-border text-sm font-medium text-ink">
            Connexion
          </Link>
        </nav>
      )}
    </header>
  );
}
