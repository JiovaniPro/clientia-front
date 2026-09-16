"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { EmailHistoryTab } from "@/components/admin/emails/EmailHistoryTab";
import { EmailTemplatesTab } from "@/components/admin/emails/EmailTemplatesTab";

type Tab = "templates" | "history";

/**
 * Écran d'administration §5.12 — Modèles (sous-lot 2) + Historique (sous-lot 3,
 * lecture seule filtrable). Un seul écran à deux onglets, gaté `emails.manageTemplates`
 * pour l'accès à la page ; la lecture de l'historique reste protégée côté backend par
 * `emails.viewHistory` (les deux permissions sont attribuées ensemble à Administrateur).
 */
export default function AdminEmailsPage() {
  const [tab, setTab] = useState<Tab>("templates");

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
        <h1 className="font-display text-2xl font-bold text-ink">E-mails</h1>
      </header>

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

      {tab === "templates" ? <EmailTemplatesTab /> : <EmailHistoryTab />}
    </div>
  );
}
