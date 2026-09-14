"use client";

import { ReportsOverview } from "@/components/reports/ReportsOverview";

/**
 * §5.15 — tableau de bord admin, vue globale de l'organisation. Réservé à
 * `reports.viewAll` (voir lib/nav/navItems.ts). La vue individuelle "mes
 * statistiques" (§5.17) est l'écran séparé /my-stats, sur `reports.view` seul.
 */
export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
        <h1 className="font-display text-2xl font-bold text-ink">Tableau de bord</h1>
      </header>

      <ReportsOverview />
    </div>
  );
}
