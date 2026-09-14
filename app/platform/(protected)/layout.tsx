"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

const NAV_ITEMS = [{ href: "/platform", label: "Accueil" }, { href: "/platform/organizations", label: "Organisations" }];

const CHANGE_PASSWORD_PATH = "/platform/change-password";

/**
 * Garde + coquille du côté protégé de la console Super Admin — miroir de
 * app/(app)/layout.tsx, mais avec une redirection supplémentaire : un compte dont
 * `mustChangePassword` est vrai ne doit voir AUCUN autre écran avant d'avoir changé
 * son mot de passe (§5.29 sous-lot 3 — mot de passe initial tapé par le créateur,
 * jamais transmis par lien puisqu'un Super Admin n'a pas d'organisation à qui
 * l'infra d'e-mail existante pourrait l'envoyer).
 */
export default function PlatformProtectedLayout({ children }: LayoutProps<"/platform">) {
  const { platformAdmin, isLoading, logout } = usePlatformAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!platformAdmin) {
      router.replace("/platform/login");
      return;
    }
    if (platformAdmin.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH);
    }
  }, [isLoading, platformAdmin, pathname, router]);

  if (isLoading || !platformAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-mono text-sm text-ink-muted">Chargement…</p>
      </div>
    );
  }

  if (platformAdmin.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    // Redirection déjà déclenchée par l'effet ci-dessus — ne pas rendre le contenu
    // protégé même le temps d'une frame pendant que la navigation se produit.
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-terracotta-500">Console Super Admin</p>
            <p className="font-display text-lg font-bold text-ink">CLIENTIA</p>
          </div>
          <nav className="flex items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium hover:text-ink",
                  pathname === item.href ? "text-ink" : "text-ink-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">{platformAdmin.email}</span>
          <Button variant="secondary" size="sm" onClick={() => logout().then(() => router.replace("/platform/login"))}>
            Se déconnecter
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
