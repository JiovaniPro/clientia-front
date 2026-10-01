"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ReminderPopupListener } from "@/components/shell/ReminderPopupListener";
import { SideRail } from "@/components/shell/SideRail";
import { useAuth } from "@/lib/auth/AuthContext";
import { isAgentRdvNavProfile } from "@/lib/nav/navItems";

/**
 * Portail d'authentification côté client, pas via `proxy.ts` : le cookie de refresh
 * appartient à l'origine du backend (localhost:4000), invisible depuis le serveur
 * Next (localhost:3000) qui exécute proxy.ts — seul le JS du navigateur peut
 * l'utiliser (fetch credentials:"include"). La vraie frontière de sécurité reste le
 * backend (chaque route vérifie son propre token) ; ceci n'est qu'un confort d'UI.
 */
export default function AppShellLayout({ children }: LayoutProps<"/">) {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // §5.4 — l'Agent RDV (même signal de capacité que sa nav dédiée, jamais un nom de rôle)
  // n'a pas d'usage de l'écran "Aujourd'hui" (/today) : accueil = son tableau de bord. Ici et non dans
  // today/page.tsx pour ne pas pouvoir être contourné (pathname ignore la query string).
  const redirectToAgentDashboard = Boolean(user) && pathname === "/today" && isAgentRdvNavProfile(hasPermission);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    else if (redirectToAgentDashboard) router.replace("/agent-rdv/dashboard");
  }, [isLoading, user, redirectToAgentDashboard, router]);

  if (isLoading || !user || redirectToAgentDashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-mono text-sm text-ink-muted">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <SideRail />
      <main className="flex-1 overflow-y-auto bg-cream">{children}</main>
      <CommandPalette />
      <ReminderPopupListener />
    </div>
  );
}
