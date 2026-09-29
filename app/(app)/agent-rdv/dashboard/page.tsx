"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppointmentsListModal } from "@/components/reports/AppointmentsListModal";
import { ClientsListModal } from "@/components/reports/ClientsListModal";
import { APPOINTMENT_STATUS_LABELS, ChartCard, StatCard } from "@/components/reports/ReportsOverview";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { AppointmentsReportDTO } from "@/lib/api/reports";
import { getAppointmentsReport, getSignedContractsCount } from "@/lib/api/reports";
import { useAuth } from "@/lib/auth/AuthContext";
import type { AppointmentStatus } from "@/lib/api/calendar";

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["EN_ATTENTE_DE_CONFIRMATION", "CONFIRME"];
const REFUSED_STATUSES: AppointmentStatus[] = ["REFUSE"];

type DrillDown = { title: string; from: string; to: string; statusFilter?: AppointmentStatus[] };

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function countByStatus(report: AppointmentsReportDTO | null, statuses: string[]) {
  if (!report) return 0;
  return report.byStatus.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s.count, 0);
}

/**
 * §5.27 "Tableau de bord" — 3 des 4 KPI du brief original (Contrats signés, RDV à
 * venir, Refusés) + le graphique 30 jours. "RDV manqués" et "Refusés/replanifiés"
 * (la partie "replanifiés") sont volontairement absents : aucune donnée ne permet
 * de les calculer aujourd'hui (ni statut "manqué"/"honoré", ni notion de
 * "replanifié" — voir l'audit §5.25-§5.28), chantier séparé à cadrer. Pas de
 * bandeau de délégation non plus, même raison — reporté.
 */
export default function AgentRdvDashboardPage() {
  const { authedFetch, user } = useAuth();

  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [signedDrillDown, setSignedDrillDown] = useState<{ finalStatusKey: string } | null>(null);
  const [signedCount, setSignedCount] = useState<number | null>(null);
  const [thisMonthAppointments, setThisMonthAppointments] = useState<AppointmentsReportDTO | null>(null);
  const [next7Days, setNext7Days] = useState<AppointmentsReportDTO | null>(null);
  const [last30Days, setLast30Days] = useState<AppointmentsReportDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ranges = useMemo(() => {
    const now = new Date();
    return {
      monthStart: startOfMonth(),
      now,
      in7Days: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      days30Ago: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [signed, monthAppointments, upcoming, last30] = await Promise.all([
        authedFetch((token) => getSignedContractsCount(undefined, token)),
        authedFetch((token) => getAppointmentsReport({ from: ranges.monthStart, to: ranges.now }, token)),
        authedFetch((token) => getAppointmentsReport({ from: ranges.now, to: ranges.in7Days }, token)),
        authedFetch((token) => getAppointmentsReport({ from: ranges.days30Ago, to: ranges.now }, token)),
      ]);
      setSignedCount(signed.count);
      setThisMonthAppointments(monthAppointments);
      setNext7Days(upcoming);
      setLast30Days(last30);
    } catch {
      setError("Impossible de charger le tableau de bord.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, ranges]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const chartData =
    last30Days?.byStatus.map((s) => ({ name: APPOINTMENT_STATUS_LABELS[s.status] ?? s.status, count: s.count })) ?? [];

  /**
   * "Contrats signés" (§6.13, point 5) : résout le statut final "signé" via CLIENT_FINAL_STATUS — jamais
   * codé en dur — puis ouvre la modale filtrée dessus. GET /clients n'accepte qu'UNE clé de statut final
   * (contrairement à statusKeys sur /calls) : si une organisation configurait PLUSIEURS statuts marqués
   * "compte comme signé", seul le premier serait filtré ici, alors que le chiffre de la carte (§5.27,
   * getSignedContractsCount) les somme tous — écart connu, pas rencontré avec les données par défaut (un
   * seul statut "Dossier validé" porte ce drapeau).
   */
  async function openSignedDrillDown() {
    const items = await authedFetch((token) => getConfigurableList("CLIENT_FINAL_STATUS", token));
    const signedKey = items.find((i) => i.metadata?.countsAsSignedContract)?.key;
    if (signedKey) setSignedDrillDown({ finalStatusKey: signedKey });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.27</p>
          <h1 className="font-display text-2xl font-bold text-ink">Tableau de bord</h1>
        </div>
        <Link href="/agent-rdv/dashboard/details" className="text-sm font-medium text-forest-600 hover:underline">
          Détail du suivi →
        </Link>
      </header>

      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Contrats signés (ce mois)"
              value={signedCount ?? 0}
              onClick={signedCount && signedCount > 0 ? openSignedDrillDown : undefined}
            />
            <StatCard
              label="RDV à venir (7 jours)"
              value={countByStatus(next7Days, ACTIVE_APPOINTMENT_STATUSES)}
              onClick={() =>
                setDrillDown({
                  title: "RDV à venir (7 jours)",
                  from: ranges.now.toISOString(),
                  to: ranges.in7Days.toISOString(),
                  statusFilter: ACTIVE_APPOINTMENT_STATUSES,
                })
              }
            />
            <StatCard
              label="Refusés (ce mois)"
              value={countByStatus(thisMonthAppointments, REFUSED_STATUSES)}
              onClick={() =>
                setDrillDown({
                  title: "Refusés (ce mois)",
                  from: ranges.monthStart.toISOString(),
                  to: ranges.now.toISOString(),
                  statusFilter: REFUSED_STATUSES,
                })
              }
            />
          </div>

          <ChartCard title="Répartition des statuts de RDV (30 derniers jours)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-ink-muted)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="var(--color-ink-muted)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-terracotta-500)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}

      {/* §6.13 — portée toujours self (cette page n'a pas de sélecteur d'agent, contrairement à /my-stats) :
          agentRdvId = l'agent RDV connecté, exactement ce que les cartes affichent déjà. */}
      {drillDown ? (
        <AppointmentsListModal
          title={drillDown.title}
          from={drillDown.from}
          to={drillDown.to}
          agentRdvId={user?.id}
          statusFilter={drillDown.statusFilter}
          onClose={() => setDrillDown(null)}
        />
      ) : null}

      {/* §6.13 — updatedAt est une APPROXIMATION de la date de signature (aucune date de signature réelle
          stockée) : même limite déjà documentée sur getSignedContractsCount côté backend, rappelée ici
          plutôt que de laisser croire à une date exacte. Portée toujours self, comme les autres cartes de
          cette page. */}
      {signedDrillDown ? (
        <ClientsListModal
          title="Contrats signés — ce mois (date de dernière modification du dossier, approximative)"
          updatedFrom={ranges.monthStart.toISOString()}
          updatedTo={ranges.now.toISOString()}
          finalStatusKey={signedDrillDown.finalStatusKey}
          agentId={user?.id}
          onClose={() => setSignedDrillDown(null)}
        />
      ) : null}
    </div>
  );
}
