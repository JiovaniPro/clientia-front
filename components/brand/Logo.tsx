import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Logo CLIENTIA — fichiers public/brand/, dérivés des PNG source de la racine du dépôt :
 * recadrés, terracotta ramenée à #C9622B, variantes sombres reconstruites à partir de la
 * forme des variantes claires (l'export sombre d'origine avait un halo gris incrusté).
 *
 * Suit le thème par CSS seul, sur la classe `.dark` de <html> que bascule ThemeToggle :
 * les deux variantes sont rendues, une seule est affichée (display:none sur l'autre, donc
 * ignorée aussi des lecteurs d'écran). Pas d'état JS, donc pas de flash au chargement.
 */
const LOGOS = {
  full: { light: "/brand/logo-full-light.png", dark: "/brand/logo-full-dark.png", width: 640, height: 194 },
  mini: { light: "/brand/logo-mini-light.png", dark: "/brand/logo-mini-dark.png", width: 480, height: 72 },
} as const;

interface LogoProps {
  /** full = symbole + mot « CLIENTIA » ; mini = symbole seul. */
  variant?: "full" | "mini";
  /** Hauteur affichée (la largeur suit le ratio). */
  className?: string;
  priority?: boolean;
}

export function Logo({ variant = "full", className = "h-10", priority = false }: LogoProps) {
  const { light, dark, width, height } = LOGOS[variant];
  const common = { width, height, priority };
  return (
    <>
      <Image src={light} alt="CLIENTIA" {...common} className={cn("w-auto dark:hidden", className)} />
      <Image src={dark} alt="CLIENTIA" {...common} className={cn("hidden w-auto dark:block", className)} />
    </>
  );
}
