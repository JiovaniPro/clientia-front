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
import type { AppointmentsReportDTO, CallsReportDTO, ClientsReportDTO } from "@/lib/api/reports";
import { getAppointmentsReport, getCallsReport, getClientsReport } from "@/lib/api/reports";
import { useAuth } from "@/lib/auth/AuthContext";

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
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
            <StatCard label="Appels" value={calls.total} />
            <StatCard label="Rendez-vous" value={appointments.total} />
            <StatCard label="Nouveaux dossiers" value={clients.total} />
            <StatCard
              label="Taux de conversion"
              value={formatConversionRate(calls.conversion.rate)}
              detail={`${calls.conversion.triggeringCount} appel${calls.conversion.triggeringCount > 1 ? "s" : ""} concluant${calls.conversion.triggeringCount > 1 ? "s" : ""}`}
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
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-flat">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-xs text-ink-muted">{detail}</p> : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-flat">
      <h2 className="mb-2 font-display text-sm font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}
