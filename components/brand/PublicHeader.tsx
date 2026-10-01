import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/**
 * En-tête des pages publiques (landing §5.1 et suivantes) : logo, bascule de thème,
 * lien « Connexion ». Volontairement sans lien d'inscription — inscription publique
 * fermée (décision actée, chantier landing).
 */
export function PublicHeader() {
  return (
    <header className="border-b border-border bg-cream">
      {/* Même colonne (max-w-7xl) que le contenu des pages publiques : le logo s'aligne sur le titre. */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
          <Logo className="h-8" priority />
        </Link>
        <nav aria-label="Navigation publique" className="flex items-center gap-2">
          <ThemeToggle />
          {/* dark:text-cream : le blanc sur l'accent sombre #3FA383 n'atteint que 3.1:1 ; l'encre sombre, 5.9:1. */}
          <Link
            href="/login"
            className="inline-flex h-8 items-center justify-center rounded-md bg-forest-600 px-3 text-sm font-medium text-white transition-colors hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream dark:text-cream"
          >
            Connexion
          </Link>
        </nav>
      </div>
    </header>
  );
}
