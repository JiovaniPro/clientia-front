"use client";

import type { ReactNode } from "react";
import { SideRail } from "@/components/shell/SideRail";
import { TopBar } from "@/components/shell/TopBar";
import { useNotificationsBadge } from "@/lib/notifications/useNotificationsBadge";

/**
 * Cadre de l'app connectée : rail à gauche, barre du haut, contenu qui défile. La pastille des notifications
 * est calculée ici, une seule fois, puis passée à la cloche de la barre du haut.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const showNotificationsBadge = useNotificationsBadge();
  return (
    <>
      <SideRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar showNotificationsBadge={showNotificationsBadge} />
        <main className="flex-1 overflow-y-auto bg-cream">{children}</main>
      </div>
    </>
  );
}
