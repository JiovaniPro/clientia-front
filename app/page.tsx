"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LandingPage } from "@/components/landing/LandingPage";
import { useAuth } from "@/lib/auth/AuthContext";
import { isAgentRdvNavProfile } from "@/lib/nav/navItems";

/**
 * Aiguillage de `/` : visiteur → landing ; connecté → son écran de départ (Agent RDV :
 * tableau de bord, sinon /today). La session n'est connue que côté client (voir
 * app/(app)/layout.tsx) : tant qu'elle n'est pas tranchée, écran neutre — jamais la
 * landing, pour qu'un utilisateur connecté ne la voie pas clignoter avant la redirection.
 */
export default function RootPage() {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const home = user ? (isAgentRdvNavProfile(hasPermission) ? "/agent-rdv/dashboard" : "/today") : null;

  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);

  if (isLoading || home) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-mono text-sm text-ink-muted">Chargement…</p>
      </div>
    );
  }

  return <LandingPage />;
}
