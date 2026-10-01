"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

/** Ancres internes de la landing (défilement doux : globals.css, marqueur data-landing). */
export const LANDING_NAV = [
  { href: "#prospection", label: "Prospection" },
  { href: "#telephonique", label: "Téléphonique" },
  { href: "#rendez-vous", label: "Prise de rendez-vous" },
  { href: "#agenda", label: "Agenda partagé" },
] as const;

/**
 * Interrupteur clair/sombre propre à la landing (soleil et lune de part et d'autre d'un
 * curseur) — le reste de l'app garde le contrôle segmenté ThemeToggle. Même mécanique :
 * classe `.dark` de <html>, état initial lu sur <html>, pas de persistance.
 */
export function ThemeSwitch() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Mode sombre"
      onClick={toggle}
      className="relative inline-flex h-8 w-[3.75rem] shrink-0 items-center rounded-full border border-border bg-surface-subtle transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <Sun aria-hidden strokeWidth={1.5} className="absolute left-2 h-3.5 w-3.5 text-ink-muted" />
      <Moon aria-hidden strokeWidth={1.5} className="absolute right-2 h-3.5 w-3.5 text-ink-muted" />
      {/* Curseur : porte l'icône du thème actif, glisse d'un côté à l'autre. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 text-white shadow-flat transition-transform duration-150 ease-out dark:text-cream",
          dark ? "translate-x-[30px]" : "translate-x-0", // 58px intérieurs − 24px de curseur − 2 × 2px de marge
        )}
      >
        {dark ? <Moon strokeWidth={1.5} className="h-3.5 w-3.5" /> : <Sun strokeWidth={1.5} className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

/**
 * En-tête de la landing : logo, ancres de section au centre (masquées sous md : la page
 * reste parcourable au défilement), interrupteur de thème, « Connexion ». Collant pour que
 * les ancres restent accessibles pendant la lecture ; fond plein (pas de flou).
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-cream">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
          <Logo className="h-8" priority />
        </Link>
        <nav aria-label="Sections de la page" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {LANDING_NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <ThemeSwitch />
          {/* dark:text-cream : le blanc sur l'accent sombre #3FA383 n'atteint que 3.1:1 ; l'encre sombre, 5.9:1. */}
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md bg-forest-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream dark:text-cream"
          >
            Connexion
          </Link>
        </div>
      </div>
    </header>
  );
}
