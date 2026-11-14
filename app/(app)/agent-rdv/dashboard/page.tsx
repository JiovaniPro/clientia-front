"use client";

import { BadgeCheck, Ban, CalendarCheck, CalendarClock, CalendarDays, CalendarX2, CircleX } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppointmentsListModal, type AttendanceState } from "@/components/reports/AppointmentsListModal";
import { ClientsListModal } from "@/components/reports/ClientsListModal";
import {
  APPOINTMENT_STATUS_LABELS,
  BarList,
  ChartCard,
  countDelta,
  OverviewSkeleton,
  PERIODS,
  PeriodSwitch,
  periodRange,
  StatCard,
  type PeriodKey,
} from "@/components/reports/ReportsOverview";
import { TodoLink } from "@/components/reports/TodoStrip";
import { EmptyState, LoadError } from "@/components/ui/ListStates";
import { PageTitle } from "@/components/ui/PageTitle";
import type { AppointmentStatus } from "@/lib/api/calendar";
import { getPendingAppointmentsCount } from "@/lib/api/calendar";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { AppointmentsReportDTO } from "@/lib/api/reports";
import { getAppointmentsReport, getSignedContractsCount } from "@/lib/api/reports";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["EN_ATTENTE_DE_CONFIRMATION", "CONFIRME"];
const REFUSED_STATUSES: AppointmentStatus[] = ["REFUSE"];
const CANCELLED_STATUSES: AppointmentStatus[] = ["ANNULE"];
/**
 * Un rendez-vous annulé ou refusé est presque toujours un rendez-vous À VENIR : la période du tableau de bord
 * court donc de son début jusqu'à cet horizon, pas jusqu'à « maintenant » — sinon l'annulation d'un rendez-vous
 * de la semaine prochaine ne s'afficherait nulle part.
 */
const UPCOMING_HORIZON_DAYS = 90;
/** Ordre fixe des barres : la forme du graphique ne change pas d'une période à l'autre. */
const STATUS_ORDER = ["EN_ATTENTE_DE_CONFIRMATION", "CONFIRME", "REFUSE", "ANNULE"] as const;
const STATUS_BAR_COLORS: Record<string, string> = {
  EN_ATTENTE_DE_CONFIRMATION: "var(--color-status-warning)",
  CONFIRME: "var(--color-status-success)",
  REFUSE: "var(--color-status-danger)",
  ANNULE: "var(--color-status-neutral)",
};
const LOAD_ERROR = "Impossible de charger le tableau de bord.";

type DrillDown = {
  title: string;
  from: string;
  to: string;
  statusFilter?: AppointmentStatus[];
  attendanceFilter?: AttendanceState;
};

/** « rendez-vous » est invariable : pas de `plural()` (qui ajouterait un s). */
const rdv = (n: number) => `${n} rendez-vous`;

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function countByStatus(report: AppointmentsReportDTO | null, statuses: string[]) {
  if (!report) return 0;
  return report.byStatus.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s.count, 0);
}

/** Info-bulle du graphique, aux couleurs de l'app (lisible en clair comme en sombre). */
function StatusTooltip({ active, payload }: { active?: boolean; payload?: { value?: number; payload?: { name: string } }[] }) {
  const item = payload?.[0];
  if (!active || !item?.payload) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="text-ink-muted">{item.payload.name}</p>
      <p className="mt-0.5 font-medium text-ink">{rdv(item.value ?? 0)}</p>
    </div>
  );
}

/**
 * §5.27 "Tableau de bord" de l'Agent RDV — même grammaire que le tableau de bord admin et « Mes
 * statistiques » : « À traiter » en haut (ce qui attend maintenant), sélecteur de période, tuiles avec
 * icône et tendance, graphique, répartition en barres, squelette au premier chargement, erreur avec relance.
 * KPI : Contrats signés (mois calendaire — l'API n'accepte pas de période libre), RDV à venir (7 jours, fixe),
 * RDV manqués (période choisie, comparés à la précédente), puis Annulés et Refusés — ceux-ci incluent les
 * rendez-vous À VENIR (voir UPCOMING_HORIZON_DAYS), sans quoi un rendez-vous annulé pour la semaine prochaine
 * n'apparaîtrait nulle part.
 * La partie « replanifiés » de « Refusés/replanifiés » reste absente : aucune notion de « replanifié »
 * dans les données (voir l'audit §5.25-§5.28).
 */
export default function AgentRdvDashboardPage() {
  const { authedFetch, user, hasPermission } = useAuth();
  const canManageAppointments = hasPermission("calendar.manageAppointments");

  const [period, setPeriod] = useState<PeriodKey>("month");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fixed, setFixed] = useState<{ signed: number; upcoming: AppointmentsReportDTO; today: AppointmentsReportDTO } | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [periodData, setPeriodData] = useState<{
    key: PeriodKey;
    report: AppointmentsReportDTO;
    previous: AppointmentsReportDTO | null;
  } | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [signedDrillDown, setSignedDrillDown] = useState<{ finalStatusKey: string } | null>(null);

  // Fenêtres fixes (ne dépendent pas de la période) : RDV de la journée, 7 prochains jours, mois en cours.
  const windows = useMemo(() => {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    const day = 24 * 60 * 60 * 1000;
    return {
      now,
      dayStart,
      dayEnd,
      in7Days: new Date(now.getTime() + 7 * day),
      horizon: new Date(now.getTime() + UPCOMING_HORIZON_DAYS * day),
      monthStart: startOfMonth(),
    };
  }, []);
  const range = useMemo(() => periodRange(PERIODS.find((p) => p.key === period)!.days), [period]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authedFetch((token) => getSignedContractsCount(undefined, token)),
      authedFetch((token) => getAppointmentsReport({ from: windows.now, to: windows.in7Days }, token)),
      authedFetch((token) => getAppointmentsReport({ from: windows.dayStart, to: windows.dayEnd }, token)),
    ])
      .then(([signed, upcoming, today]) => {
        if (!cancelled) setFixed({ signed: signed.count, upcoming, today });
      })
      .catch(() => {
        if (!cancelled) setError(LOAD_ERROR);
      });
    // « En attente de ma confirmation » : chargé à part, un échec ne doit pas faire tomber le reste.
    if (canManageAppointments) {
      authedFetch((token) => getPendingAppointmentsCount(token))
        .then((res) => {
          if (!cancelled) setPendingCount(res.count);
        })
        .catch(() => {
          if (!cancelled) setPendingCount(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [authedFetch, canManageAppointments, windows, attempt]);

  useEffect(() => {
    let cancelled = false;
    authedFetch((token) => getAppointmentsReport({ from: range.from, to: windows.horizon }, token))
      .then((report) => {
        if (cancelled) return;
        setPeriodData({ key: period, report, previous: null });
        // Tendance : chargée après, sans bloquer l'affichage ; un échec retire juste la tendance.
        return authedFetch((token) => getAppointmentsReport({ from: range.previousFrom, to: range.previousTo }, token))
          .then((previous) => {
            if (!cancelled) setPeriodData((d) => (d && d.key === period ? { ...d, previous } : d));
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setError(LOAD_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, range, windows, period, attempt]);

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

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

  const ready = fixed !== null && periodData !== null;
  const isLoading = periodData?.key !== period;
  const report = periodData?.report ?? null;
  const previous = periodData?.previous ?? null;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const comparedTo = period === "today" ? "vs hier" : "vs période précédente";

  const refused = countByStatus(report, REFUSED_STATUSES);
  const cancelled = countByStatus(report, CANCELLED_STATUSES);
  const withUpcoming = `${periodLabel} et à venir`;
  const missed = report?.attendance.missed ?? 0;
  const honored = report?.attendance.honored ?? 0;
  const unmarked = report?.attendance.unmarked ?? 0;
  const finished = honored + missed + unmarked;
  const attendanceRate = honored + missed > 0 ? honored / (honored + missed) : null;
  const todayCount = countByStatus(fixed?.today ?? null, ACTIVE_APPOINTMENT_STATUSES);

  const chartData = STATUS_ORDER.map((status) => ({
    status,
    name: APPOINTMENT_STATUS_LABELS[status] ?? status,
    count: report?.byStatus.find((s) => s.status === status)?.count ?? 0,
  }));

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageTitle parent="Suivi RDV">Tableau de bord</PageTitle>
          <p className="text-sm text-ink-muted">Vos rendez-vous, leur confirmation et leur suivi sur la période choisie.</p>
        </div>
        <Link href="/agent-rdv/dashboard/details" className="text-sm font-medium text-forest-600 hover:underline">
          Détail du suivi →
        </Link>
      </header>

      {/* Ce qui attend l'agent MAINTENANT (au-dessus des statistiques, qui regardent le passé). Le lien de
          confirmation va à /calendar-pro : l'agent doit pouvoir confirmer/refuser directement, sans modale. */}
      {fixed ? (
        <section aria-label="À traiter" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pendingCount !== null ? (
            <TodoLink
              href="/calendar-pro"
              icon={CalendarCheck}
              count={pendingCount}
              label="rendez-vous en attente de votre confirmation"
              action="Traiter"
              urgent={pendingCount > 0}
            />
          ) : null}
          <TodoLink
            href="/agent-rdv/calendar"
            icon={CalendarDays}
            count={todayCount}
            label="rendez-vous aujourd'hui"
            action="Ouvrir l'agenda"
          />
        </section>
      ) : null}

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <PeriodSwitch value={period} onChange={setPeriod} />
        </div>

        {error ? (
          <div className="rounded-lg border border-border bg-surface shadow-flat">
            <LoadError message={error} onRetry={retry} />
          </div>
        ) : !ready ? (
          <OverviewSkeleton />
        ) : (
          // Changement de période : les chiffres précédents restent affichés, estompés — rien ne saute.
          <div className={cn("space-y-5 transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard
                icon={BadgeCheck}
                label="Contrats signés (ce mois)"
                value={fixed.signed}
                detail="dossiers validés ce mois-ci"
                onClick={fixed.signed > 0 ? openSignedDrillDown : undefined}
              />
              <StatCard
                icon={CalendarClock}
                label="RDV à venir (7 jours)"
                value={countByStatus(fixed.upcoming, ACTIVE_APPOINTMENT_STATUSES)}
                detail="en attente ou confirmés"
                onClick={() =>
                  setDrillDown({
                    title: "RDV à venir (7 jours)",
                    from: windows.now.toISOString(),
                    to: windows.in7Days.toISOString(),
                    statusFilter: ACTIVE_APPOINTMENT_STATUSES,
                  })
                }
              />
              <StatCard
                icon={CalendarX2}
                label="RDV manqués"
                value={missed}
                detail={`sur ${rdv(finished)} terminé${finished > 1 ? "s" : ""}, ${periodLabel}`}
                delta={previous ? countDelta(missed, previous.attendance.missed) : undefined}
                deltaHint={comparedTo}
                lowerIsBetter
                onClick={() =>
                  setDrillDown({
                    title: `RDV manqués — ${periodLabel}`,
                    from: range.from.toISOString(),
                    to: range.to.toISOString(),
                    attendanceFilter: "missed",
                  })
                }
              />
              <StatCard
                icon={Ban}
                label="Annulés"
                value={cancelled}
                detail={withUpcoming}
                onClick={() =>
                  setDrillDown({
                    title: `Annulés — ${withUpcoming}`,
                    from: range.from.toISOString(),
                    to: windows.horizon.toISOString(),
                    statusFilter: CANCELLED_STATUSES,
                  })
                }
              />
              <StatCard
                icon={CircleX}
                label="Refusés"
                value={refused}
                detail={withUpcoming}
                onClick={() =>
                  setDrillDown({
                    title: `Refusés — ${withUpcoming}`,
                    from: range.from.toISOString(),
                    to: windows.horizon.toISOString(),
                    statusFilter: REFUSED_STATUSES,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ChartCard title="Rendez-vous par statut" aside={report!.total > 0 ? `${rdv(report!.total)} · ${withUpcoming}` : null}>
                  {report!.total > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke="var(--color-border)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--color-border)" }}
                        />
                        <YAxis allowDecimals={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: "var(--color-surface-subtle)" }} content={<StatusTooltip />} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={72}>
                          {chartData.map((d) => (
                            <Cell key={d.status} fill={STATUS_BAR_COLORS[d.status]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="Aucun rendez-vous sur cette période."
                      description="Le graphique se remplit dès qu'un rendez-vous vous est confié."
                    />
                  )}
                </ChartCard>
              </div>

              <ChartCard
                title="Suivi des présences"
                aside={
                  attendanceRate !== null ? (
                    <>
                      Taux de présence <span className="font-mono font-medium text-ink">{Math.round(attendanceRate * 100)} %</span>
                    </>
                  ) : null
                }
              >
                {finished === 0 ? (
                  <EmptyState
                    title="Aucun rendez-vous terminé sur cette période."
                    description="Les rendez-vous confirmés apparaissent ici une fois passés."
                  />
                ) : (
                  <div className="space-y-4">
                    <BarList
                      rows={[
                        { key: "honored", label: "Honorés", count: honored },
                        { key: "missed", label: "Manqués", count: missed },
                        { key: "unmarked", label: "Non marqués", count: unmarked },
                      ]}
                      total={finished}
                    />
                    {unmarked > 0 ? (
                      <Link href="/agent-rdv/calendar" className="inline-block text-sm font-medium text-forest-600 hover:underline">
                        Marquer {unmarked > 1 ? "ces rendez-vous" : "ce rendez-vous"} dans l&apos;agenda →
                      </Link>
                    ) : null}
                  </div>
                )}
              </ChartCard>
            </div>
          </div>
        )}
      </div>

      {/* §6.13 — portée toujours self (cette page n'a pas de sélecteur d'agent, contrairement à /my-stats) :
          agentRdvId = l'agent RDV connecté, exactement ce que les cartes affichent déjà. */}
      {drillDown ? (
        <AppointmentsListModal
          title={drillDown.title}
          from={drillDown.from}
          to={drillDown.to}
          agentRdvId={user?.id}
          statusFilter={drillDown.statusFilter}
          attendanceFilter={drillDown.attendanceFilter}
          onClose={() => setDrillDown(null)}
        />
      ) : null}

      {/* §6.13 — updatedAt est une APPROXIMATION de la date de signature (aucune date de signature réelle
          stockée) : même limite déjà documentée sur getSignedContractsCount côté backend, rappelée ici
          plutôt que de laisser croire à une date exacte. Portée toujours self, comme les autres cartes de
          cette page. */}
      {signedDrillDown ? (
        <ClientsListModal
          title="Contrats signés ce mois-ci"
          updatedFrom={windows.monthStart.toISOString()}
          updatedTo={windows.now.toISOString()}
          finalStatusKey={signedDrillDown.finalStatusKey}
          agentId={user?.id}
          onClose={() => setSignedDrillDown(null)}
        />
      ) : null}
    </div>
  );
}
