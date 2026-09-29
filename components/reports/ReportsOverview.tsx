"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppointmentsListModal } from "@/components/reports/AppointmentsListModal";
import { CallsListModal } from "@/components/reports/CallsListModal";
import { ClientsListModal } from "@/components/reports/ClientsListModal";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { AppointmentsReportDTO, CallsReportDTO, ClientsReportDTO } from "@/lib/api/reports";
import { getAppointmentsReport, getCallsReport, getClientsReport } from "@/lib/api/reports";
import { useAuth } from "@/lib/auth/AuthContext";

/** Exporté — réutilisé par le tableau de bord Agent RDV (§5.27). */
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE_DE_CONFIRMATION: "En attente",
  CONFIRME: "Confirmé",
  ANNULE: "Annulé",
  REFUSE: "Refusé",
};

const CHART_COLORS = [
  "var(--color-forest-600)",
  "var(--color-terracotta-500)",
  "var(--color-status-info)",
  "var(--color-status-warning)",
  "var(--color-status-danger)",
  "var(--color-ink-faint)",
];

export type PeriodKey = "today" | "week" | "month";
export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "today", label: "Aujourd'hui", days: 1 },
  { key: "week", label: "7 derniers jours", days: 7 },
  { key: "month", label: "30 derniers jours", days: 30 },
];

function periodRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function personLabel(user: { firstName: string | null; lastName: string | null } | null, fallback: string) {
  if (!user) return fallback;
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || fallback;
}

/** Un arrondi à l'entier écraserait un taux réel-mais-faible (ex. 4/1298 ≈ 0,3%)
 * en "0%", ce qui contredirait visuellement le détail "N appels concluants" juste
 * en dessous — une décimale seulement quand le taux est non nul et sous 1%. */
function formatConversionRate(rate: number): string {
  const percent = rate * 100;
  if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

interface ReportsOverviewProps {
  /** Absent = vue globale de l'organisation (§5.15, exige reports.viewAll côté
   * backend pour ne pas être silencieusement re-scopé) ; présent = un agent précis
   * (§5.17 — y compris soi-même). Le backend reste l'autorité : un appelant sans
   * reports.viewAll est de toute façon ramené à son propre id quoi qu'on envoie ici. */
  userId?: string;
  /** Rendu au-dessus du sélecteur de période — ex. un sélecteur d'agent (§5.17). */
  extraControls?: React.ReactNode;
}

/**
 * Partagé entre le tableau de bord admin (§5.15) et les statistiques employé
 * (§5.17) — mêmes cartes, mêmes graphiques, seule la portée des données change.
 */
export function ReportsOverview({ userId, extraControls }: ReportsOverviewProps) {
  const { authedFetch } = useAuth();

  const [period, setPeriod] = useState<PeriodKey>("week");
  const [showAppointmentsDrillDown, setShowAppointmentsDrillDown] = useState(false);
  const [callsDrillDown, setCallsDrillDown] = useState<{ title: string; statusKeys?: string[] } | null>(null);
  const [showClientsDrillDown, setShowClientsDrillDown] = useState(false);
  const [calls, setCalls] = useState<CallsReportDTO | null>(null);
  const [clients, setClients] = useState<ClientsReportDTO | null>(null);
  const [appointments, setAppointments] = useState<AppointmentsReportDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => periodRange(PERIODS.find((p) => p.key === period)!.days), [period]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [callsData, clientsData, appointmentsData] = await Promise.all([
        authedFetch((token) => getCallsReport({ from, to, userId }, token)),
        authedFetch((token) => getClientsReport({ from, to }, token)),
        authedFetch((token) => getAppointmentsReport({ from, to, userId }, token)),
      ]);
      setCalls(callsData);
      setClients(clientsData);
      setAppointments(appointmentsData);
    } catch {
      setError("Impossible de charger les statistiques.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, from, to, userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  /** "Taux de conversion" (§6.13, point 3) : résout les statuts "déclenchants" via CALL_STATUS — jamais
   * codés en dur — puis ouvre la même modale que "Appels", filtrée sur ces statuts. N'affiche QUE le
   * numérateur (les appels concluants), pas le dénominateur : décision actée, ce n'est pas ce que ce
   * chiffre précis représente. */
  async function openConversionDrillDown() {
    const items = await authedFetch((token) => getConfigurableList("CALL_STATUS", token));
    const triggeringKeys = items.filter((i) => i.metadata?.triggersClientDossierCreation).map((i) => i.key);
    setCallsDrillDown({ title: `Appels concluants — ${periodLabel}`, statusKeys: triggeringKeys });
  }

  const byUserChartData = calls?.byUser.map((u) => ({ name: personLabel(u.user, "Agent supprimé"), count: u.count })) ?? [];
  const byStatusChartData = calls?.byStatus.map((s) => ({ name: s.label, count: s.count })) ?? [];
  const byFinalStatusChartData = clients?.byFinalStatus.map((s) => ({ name: s.label, count: s.count })) ?? [];
  const appointmentsByStatusChartData =
    appointments?.byStatus.map((s) => ({ name: APPOINTMENT_STATUS_LABELS[s.status] ?? s.status, count: s.count })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {extraControls}
        <div className="ml-auto flex gap-1 rounded-md border border-border bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.key ? "bg-forest-600 text-white" : "text-ink-muted hover:bg-surface-subtle"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      {isLoading || !calls || !clients || !appointments ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Appels"
              value={calls.total}
              onClick={calls.total > 0 ? () => setCallsDrillDown({ title: `Appels — ${periodLabel}` }) : undefined}
            />
            <StatCard
              label="Rendez-vous"
              value={appointments.total}
              onClick={appointments.total > 0 ? () => setShowAppointmentsDrillDown(true) : undefined}
            />
            <StatCard
              label="Nouveaux dossiers"
              value={clients.total}
              onClick={clients.total > 0 ? () => setShowClientsDrillDown(true) : undefined}
            />
            <StatCard
              label="Taux de conversion"
              value={formatConversionRate(calls.conversion.rate)}
              detail={`${calls.conversion.triggeringCount} appel${calls.conversion.triggeringCount > 1 ? "s" : ""} concluant${calls.conversion.triggeringCount > 1 ? "s" : ""}`}
              onClick={calls.conversion.triggeringCount > 0 ? openConversionDrillDown : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChartCard title={userId ? "Appels" : "Appels par agent"}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byUserChartData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" allowDecimals={false} stroke="var(--color-ink-muted)" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-ink-muted)" fontSize={12} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-forest-600)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Appels par statut">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byStatusChartData} dataKey="count" nameKey="name" outerRadius={90} label>
                    {byStatusChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Rendez-vous par statut">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={appointmentsByStatusChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-ink-muted)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-ink-muted)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-terracotta-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Dossiers par statut final">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byFinalStatusChartData} dataKey="count" nameKey="name" outerRadius={90} label>
                    {byFinalStatusChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* §6.13 — la portée hérite du contexte déjà affiché sur cette carte : userId absent = ce que
          calendar.viewAll autorise (org entière sur /admin/dashboard) ; userId renseigné = ce collègue
          précis (agent lui-même ou choisi via le sélecteur sur /my-stats), jamais recalculée ici. */}
      {showAppointmentsDrillDown ? (
        <AppointmentsListModal
          title={`Rendez-vous — ${periodLabel}`}
          from={from.toISOString()}
          to={to.toISOString()}
          agentRdvId={userId}
          onClose={() => setShowAppointmentsDrillDown(false)}
        />
      ) : null}

      {/* §6.13 — même héritage de portée que ci-dessus, sur userId (calls.viewAll côté backend). */}
      {callsDrillDown ? (
        <CallsListModal
          title={callsDrillDown.title}
          from={from.toISOString()}
          to={to.toISOString()}
          userId={userId}
          statusKeys={callsDrillDown.statusKeys}
          onClose={() => setCallsDrillDown(null)}
        />
      ) : null}

      {/* §6.13 — "Nouveaux dossiers" est un dossier CRÉÉ dans la période (createdFrom/createdTo), pas
          modifié : distinct du drill-down "Contrats signés" de l'agent RDV (updatedFrom/updatedTo). */}
      {showClientsDrillDown ? (
        <ClientsListModal
          title={`Nouveaux dossiers — ${periodLabel}`}
          createdFrom={from.toISOString()}
          createdTo={to.toISOString()}
          agentId={userId}
          onClose={() => setShowClientsDrillDown(false)}
        />
      ) : null}
    </div>
  );
}

/** Exporté — réutilisé par le tableau de bord Agent RDV (§5.27), mêmes tuiles/graphiques. */
export function StatCard({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: number | string;
  detail?: string;
  /** §6.13 — drill-down KPI : présent seulement quand un clic ouvre effectivement une liste (ex. jamais sur "Taux de conversion" tant que son drill-down n'est pas branché). */
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-xs text-ink-muted">{detail}</p> : null}
    </>
  );

  if (!onClick) {
    return <div className="rounded-lg border border-border bg-surface p-4 shadow-flat">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-surface p-4 text-left shadow-flat transition-colors hover:border-forest-600 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
    >
      {content}
    </button>
  );
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-flat">
      <h2 className="mb-2 font-display text-sm font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}
