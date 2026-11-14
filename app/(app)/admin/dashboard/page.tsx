"use client";

import { ReportsOverview } from "@/components/reports/ReportsOverview";
import { PageTitle } from "@/components/ui/PageTitle";

/**
 * §5.15 — tableau de bord admin, vue globale de l'organisation. Réservé à
 * `reports.viewAll` (voir lib/nav/navItems.ts). La vue individuelle "mes
 * statistiques" (§5.17) est l'écran séparé /my-stats, sur `reports.view` seul.
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <PageTitle parent="Administration">Tableau de bord</PageTitle>
      </header>

      <ReportsOverview />
    </div>
  );
}
