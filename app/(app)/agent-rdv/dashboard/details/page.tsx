"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { AppointmentsListModal } from "@/components/reports/AppointmentsListModal";
import type { AppointmentsHistoryPeriodDTO } from "@/lib/api/reports";
import { getAppointmentsHistory } from "@/lib/api/reports";
import { useAuth } from "@/lib/auth/AuthContext";

type Granularity = "week" | "month";
const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "short" });
}

function formatRate(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

/**
 * §5.28 "Détail du suivi" — historique période par période. Colonnes disponibles
 * aujourd'hui uniquement (arbitrage acté avec l'utilisateur) : RDV total,
 * confirmés, refusés, honorés / manqués / non marqués (chantier honoré/manqué,
 * sous-lot 4), contrats signés, taux de conversion.
 */
export default function AgentRdvDetailsPage() {
  const { authedFetch, user, hasPermission } = useAuth();

  const [granularity, setGranularity] = useState<Granularity>("week");
  const [periods, setPeriods] = useState<AppointmentsHistoryPeriodDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<AppointmentsHistoryPeriodDTO | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authedFetch((token) => getAppointmentsHistory({ granularity, periods: 8 }, token));
      // Le plus récent en premier à l'écran (le backend renvoie du plus ancien au plus récent).
      setPeriods([...result.periods].reverse());
    } catch {
      setError("Impossible de charger l'historique.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, granularity]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const columns: AdminTableColumn<AppointmentsHistoryPeriodDTO>[] = [
    {
      header: "Période",
      className: "text-ink",
      cell: (p) => `${formatDate(p.from)} – ${formatDate(p.to)}`,
    },
    { header: "RDV total", className: "text-ink-muted", cell: (p) => p.totalAppointments },
    { header: "Confirmés", className: "text-ink-muted", cell: (p) => p.confirmedCount },
    { header: "Refusés", className: "text-ink-muted", cell: (p) => p.refusedCount },
    // RDV confirmés et terminés de la période uniquement — pas de date de coupure :
    // les anciens RDV jamais marqués comptent "non marqués" (décision actée).
    { header: "Honorés", className: "text-ink-muted", cell: (p) => p.honoredCount },
    { header: "Manqués", className: "text-ink-muted", cell: (p) => p.missedCount },
    { header: "Non marqués", className: "text-ink-muted", cell: (p) => p.unmarkedCount },
    { header: "Contrats signés", className: "text-ink-muted", cell: (p) => p.signedContracts },
    { header: "Taux de conversion", className: "text-ink-muted", cell: (p) => formatRate(p.conversionRate) },
    {
      header: "",
      className: "text-right",
      cell: (p) => (
        <button
          type="button"
          className="text-xs font-medium text-forest-600 hover:underline"
          onClick={() => setDetailPeriod(p)}
        >
          Voir le détail
        </button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/agent-rdv/dashboard" className="text-sm text-ink-muted hover:text-ink">
            ← Tableau de bord
          </Link>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.28</p>
          <h1 className="font-display text-2xl font-bold text-ink">Détail du suivi</h1>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-surface p-1">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGranularity(g.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                granularity === g.key ? "bg-forest-600 text-white" : "text-ink-muted hover:bg-surface-subtle"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <AdminTable
        columns={columns}
        rows={periods}
        rowKey={(p) => p.from}
        isLoading={isLoading}
        emptyMessage="Aucune période à afficher."
      />

      {detailPeriod ? (
        <AppointmentsListModal
          title={`RDV du ${formatDate(detailPeriod.from)} au ${formatDate(detailPeriod.to)}`}
          from={detailPeriod.from}
          to={detailPeriod.to}
          // Vue calendrier partagée : GET /calendar-events ne restreint plus à ses propres RDV —
          // on aligne explicitement le détail sur la portée des chiffres (reports.viewAll ou soi).
          agentRdvId={hasPermission("reports.viewAll") ? undefined : user?.id}
          onClose={() => setDetailPeriod(null)}
        />
      ) : null}
    </div>
  );
}
