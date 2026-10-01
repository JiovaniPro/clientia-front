"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
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
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link href="/platform" className="flex items-center gap-3" aria-label="Console Super Admin — accueil">
              <Logo variant="mini" className="h-5" priority />
              <span className="rounded-sm border border-terracotta-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-terracotta-500">
                Super Admin
              </span>
            </Link>
            <nav className="flex h-14 items-stretch gap-6">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/platform" ? pathname === "/platform" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "-mb-px flex items-center border-b-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-forest-600 text-ink"
                        : "border-transparent text-ink-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-ink-muted sm:inline">{platformAdmin.email}</span>
            <Button variant="secondary" size="sm" onClick={() => setShowLogoutConfirm(true)}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>

      {showLogoutConfirm ? (
        <ConfirmModal
          title="Se déconnecter"
          message="Se déconnecter maintenant ?"
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
