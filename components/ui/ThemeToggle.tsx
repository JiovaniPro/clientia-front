"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Bascule clair/sombre — contrôle segmenté (capsule, soleil / lune), option active sur fond
 * vert forêt. Agit sur la classe `.dark` de <html> (celle que lisent les tokens de
 * globals.css et le Logo). Pas de persistance : l'état initial est lu sur <html>, jamais
 * supposé (l'ancien bouton texte affichait « Mode sombre » même déjà en sombre).
 * Capsule `rounded-full` : exception assumée au plafond de rayon du brief, demandée pour ce contrôle.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  function apply(next: boolean) {
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  }

  const option = (active: boolean) =>
    cn(
      "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
      active ? "bg-forest-600 text-white dark:text-cream" : "text-ink-muted hover:text-ink",
    );

  return (
    <div role="group" aria-label="Thème" className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
      <button type="button" aria-label="Mode clair" aria-pressed={!dark} onClick={() => apply(false)} className={option(!dark)}>
        <Sun aria-hidden className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <button type="button" aria-label="Mode sombre" aria-pressed={dark} onClick={() => apply(true)} className={option(dark)}>
        <Moon aria-hidden className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
