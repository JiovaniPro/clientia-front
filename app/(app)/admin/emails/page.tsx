"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { EmailHistoryTab } from "@/components/admin/emails/EmailHistoryTab";
import { EmailTemplatesTab } from "@/components/admin/emails/EmailTemplatesTab";
import { useAuth } from "@/lib/auth/AuthContext";

type Tab = "templates" | "history";

/**
 * Écran e-mails §5.12 — Modèles (sous-lot 2, gate backend `emails.manageTemplates`)
 * + Historique (sous-lot 3, gate backend `emails.viewHistory`). Deux permissions
 * distinctes, pas une seule : un Agent RDV a `emails.viewHistory`/`emails.send`
 * mais jamais `emails.manageTemplates` (§5.25-§5.28, nav dédiée) — sans ce garde
 * par onglet, il atterrirait sur l'onglet Modèles et se prendrait un 403 sur
 * `listTemplates`. Chaque onglet n'est proposé que si la permission backend
 * correspondante est là ; l'onglet par défaut est le premier disponible.
 */
export default function AdminEmailsPage() {
  const { hasPermission } = useAuth();
  const canManageTemplates = hasPermission("emails.manageTemplates");
  const canViewHistory = hasPermission("emails.viewHistory");

  const [tab, setTab] = useState<Tab>(canManageTemplates ? "templates" : "history");

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.12</p>
        <h1 className="font-display text-2xl font-bold text-ink">E-mails</h1>
      </header>

      {!canManageTemplates && !canViewHistory ? (
        <p className="text-sm text-ink-muted">Vous n&apos;avez accès à aucune section de cet écran.</p>
      ) : (
        <>
          {canManageTemplates && canViewHistory ? (
            <div className="flex gap-1 border-b border-border">
              <button
                type="button"
                onClick={() => setTab("templates")}
                className={cn(
                  "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
                  tab === "templates" ? "border-forest-600 text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                Modèles
              </button>
              <button
                type="button"
                onClick={() => setTab("history")}
                className={cn(
                  "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
                  tab === "history" ? "border-forest-600 text-ink" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                Historique
              </button>
            </div>
          ) : null}

          {tab === "templates" && canManageTemplates ? <EmailTemplatesTab /> : null}
          {tab === "history" && canViewHistory ? <EmailHistoryTab /> : null}
        </>
      )}
    </div>
  );
}
