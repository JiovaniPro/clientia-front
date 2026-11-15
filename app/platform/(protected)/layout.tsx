"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

const CHANGE_PASSWORD_PATH = "/platform/change-password";

/**
 * Garde + coquille du côté protégé de la console Super Admin — miroir de
 * app/(app)/layout.tsx, mais avec une redirection supplémentaire : un compte dont
 * `mustChangePassword` est vrai ne doit voir AUCUN autre écran avant d'avoir changé
 * son mot de passe (§5.29 sous-lot 3 — mot de passe initial tapé par le créateur,
 * jamais transmis par lien puisqu'un Super Admin n'a pas d'organisation à qui
 * l'infra d'e-mail existante pourrait l'envoyer). Dans ce cas la coquille est
 * « verrouillée » : aucune navigation, seul le menu du compte (déconnexion) reste.
 */
export default function PlatformProtectedLayout({ children }: LayoutProps<"/platform">) {
  const { platformAdmin, isLoading } = usePlatformAuth();
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
      <div role="status" className="flex min-h-screen items-center justify-center bg-cream">
        <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-forest-600 motion-reduce:animate-none" />
        <span className="sr-only">Chargement de la console…</span>
      </div>
    );
  }

  if (platformAdmin.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    // Redirection déjà déclenchée par l'effet ci-dessus — ne pas rendre le contenu
    // protégé même le temps d'une frame pendant que la navigation se produit.
    return null;
  }

  return <PlatformShell locked={platformAdmin.mustChangePassword}>{children}</PlatformShell>;
}
