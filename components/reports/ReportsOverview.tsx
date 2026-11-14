"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, FolderPlus, Minus, PhoneCall, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CallsListModal } from "@/components/reports/CallsListModal";
import { ClientsListModal } from "@/components/reports/ClientsListModal";
import { EmptyState, LoadError } from "@/components/ui/ListStates";
import { CALL_TYPE_LABELS, type CallType } from "@/lib/api/calls";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { CallsReportDTO, ClientsReportDTO } from "@/lib/api/reports";
import { getCallsReport, getClientsReport } from "@/lib/api/reports";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

/** Exporté — réutilisé par le tableau de bord Agent RDV (§5.27). */
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE_DE_CONFIRMATION: "En attente",
  CONFIRME: "Confirmé",
  ANNULE: "Annulé",
  REFUSE: "Refusé",
};

export type PeriodKey = "today" | "week" | "month";
export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "today", label: "Aujourd'hui", days: 1 },
  { key: "week", label: "7 derniers jours", days: 7 },
  { key: "month", label: "30 derniers jours", days: 30 },
];

/** Sélecteur de période (Aujourd'hui / 7 / 30 jours) — partagé entre les tableaux de bord. */
export function PeriodSwitch({ value, onChange }: { value: PeriodKey; onChange: (key: PeriodKey) => void }) {
  return (
    <div className="ml-auto flex gap-1 rounded-md border border-border bg-surface p-1" role="group" aria-label="Période">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={value === p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
            value === p.key ? "bg-forest-600 text-white dark:text-cream" : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function periodRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  // Période précédente, de même durée, juste avant : sert uniquement aux tendances des tuiles.
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, previousFrom, previousTo };
}

export interface StatDelta {
  direction: "up" | "down" | "flat";
  /** Texte déjà formaté : "+12 %", "−3 pts", "Stable", "Nouveau". */
  label: string;
}

/** Évolution relative d'un comptage. Ancienne valeur à 0 : pas de pourcentage possible → "Nouveau". */
export function countDelta(current: number, previous: number): StatDelta | undefined {
  if (current === 0 && previous === 0) return undefined;
  if (previous === 0) return { direction: "up", label: "Nouveau" };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { direction: "flat", label: "Stable" };
  return { direction: percent > 0 ? "up" : "down", label: `${percent > 0 ? "+" : "−"}${Math.abs(percent)} %` };
}

/** Évolution d'un taux, en points de pourcentage (un "%" de "%" serait trompeur). */
export function rateDelta(current: number, previous: number): StatDelta | undefined {
  if (current === 0 && previous === 0) return undefined;
  const points = Math.round((current - previous) * 100);
  if (points === 0) return { direction: "flat", label: "Stable" };
  return { direction: points > 0 ? "up" : "down", label: `${points > 0 ? "+" : "−"}${Math.abs(points)} pt${Math.abs(points) > 1 ? "s" : ""}` };
}

/** "2026-11-12" → "12 nov." (construit en local : pas de décalage de jour selon le fuseau). */
function formatDay(date: string, withWeekday = false) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    ...(withWeekday ? { weekday: "long" } : {}),
  });
}

/** Plage horaire affichée : heures ouvrées (8h–19h) élargies à toute heure qui a de l'activité. */
function visibleHours(byHour: CallsReportDTO["byHour"]) {
  const active = byHour.filter((h) => h.count > 0).map((h) => h.hour);
  const start = Math.min(8, ...active);
  const end = Math.max(19, ...active);
  return byHour
    .filter((h) => h.hour >= start && h.hour <= end)
    .map((h) => ({ hour: h.hour, label: `${h.hour}h`, count: h.count }));
}

/** Un arrondi à l'entier écraserait un taux réel-mais-faible (ex. 4/1298 ≈ 0,3%)
 * en "0%", ce qui contredirait visuellement le détail "N appels concluants" juste
 * en dessous — une décimale seulement quand le taux est non nul et sous 1%. */
function formatConversionRate(rate: number): string {
  const percent = rate * 100;
  if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

interface ReportsOverviewProps {
  /** Absent = vue globale de l'organisation (§5.15, exige reports.viewAll côté
   * backend pour ne pas être silencieusement re-scopé) ; présent = un agent précis
   * (§5.17 — y compris soi-même). Le backend reste l'autorité : un appelant sans
   * reports.viewAll est de toute façon ramené à son propre id quoi qu'on envoie ici. */
  userId?: string;
  /** Rendu à gauche du sélecteur de période — ex. un sélecteur d'agent (§5.17). */
  extraControls?: React.ReactNode;
}

/**
 * Partagé entre le tableau de bord admin (§5.15) et les statistiques employé
 * (§5.17) — mêmes cartes, mêmes graphiques, seule la portée des données change.
 */
export function ReportsOverview({ userId, extraControls }: ReportsOverviewProps) {
  const { authedFetch } = useAuth();

  const [period, setPeriod] = useState<PeriodKey>("week");
  const [callsDrillDown, setCallsDrillDown] = useState<{ title: string; statusKeys?: string[] } | null>(null);
  const [showClientsDrillDown, setShowClientsDrillDown] = useState(false);
  const [calls, setCalls] = useState<CallsReportDTO | null>(null);
  const [clients, setClients] = useState<ClientsReportDTO | null>(null);
  /** Période précédente (tendances). null = pas encore chargée ou en échec : les tuiles s'affichent sans tendance. */
  const [previous, setPrevious] = useState<{ calls: CallsReportDTO; clients: ClientsReportDTO } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { from, to, previousFrom, previousTo } = useMemo(
    () => periodRange(PERIODS.find((p) => p.key === period)!.days),
    [period],
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [callsData, clientsData] = await Promise.all([
        authedFetch((token) => getCallsReport({ from, to, userId }, token)),
        // userId transmis : sans lui, l'agent choisi sur /my-stats voyait les dossiers de toute l'organisation.
        authedFetch((token) => getClientsReport({ from, to, userId }, token)),
      ]);
      setCalls(callsData);
      setClients(clientsData);
      // L'ancienne tendance ne correspond plus à ces chiffres : effacée jusqu'à l'arrivée de la nouvelle.
      setPrevious(null);
    } catch {
      setError("Impossible de charger les statistiques.");
    } finally {
      setIsLoading(false);
    }
    // Tendances : chargées après, sans bloquer l'affichage ; un échec ici retire juste les tendances.
    try {
      const range = { from: previousFrom, to: previousTo, userId };
      const [prevCalls, prevClients] = await Promise.all([
        authedFetch((token) => getCallsReport(range, token)),
        authedFetch((token) => getClientsReport(range, token)),
      ]);
      setPrevious(prevCalls && prevClients ? { calls: prevCalls, clients: prevClients } : null);
    } catch {
      setPrevious(null);
    }
  }, [authedFetch, from, to, previousFrom, previousTo, userId]);

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

  const byHourChartData = calls ? visibleHours(calls.byHour) : [];
  const peakHour = byHourChartData.reduce<{ hour: number; count: number } | null>(
    (best, h) => (h.count > 0 && (!best || h.count > best.count) ? h : best),
    null,
  );
  const byStatusRows = calls ? [...calls.byStatus].sort((a, b) => b.count - a.count) : [];
  const byStatusTotal = byStatusRows.reduce((sum, s) => sum + s.count, 0);
  const byTypeRows = calls ? [...calls.byType].sort((a, b) => b.count - a.count) : [];
  const byTypeTotal = byTypeRows.reduce((sum, t) => sum + t.count, 0);
  // Évolution par jour : sans objet sur "Aujourd'hui" (un seul point) ou si le backend ne la renvoie pas.
  const byDayChartData = (calls?.byDay ?? []).map((d) => ({ ...d, label: formatDay(d.date) }));
  const showByDay = period !== "today" && byDayChartData.length > 1;
  const bestDay = byDayChartData.reduce<{ date: string; count: number } | null>(
    (best, d) => (d.count > 0 && (!best || d.count > best.count) ? d : best),
    null,
  );
  const comparedTo = period === "today" ? "vs hier" : "vs période précédente";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">{extraControls}</div>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </div>

      {error ? (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          <LoadError message={error} onRetry={fetchAll} />
        </div>
      ) : !calls || !clients ? (
        <OverviewSkeleton />
      ) : (
        // Changement de période/agent : les chiffres précédents restent affichés, estompés — rien ne saute.
        <div className={cn("space-y-5 transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Chiffre principal : appels réellement traités, pas les leads importés en attente. */}
            <StatCard
              icon={PhoneCall}
              label="Appels qualifiés"
              value={calls.qualified}
              detail={`sur ${plural(calls.total, "appel")} de la période`}
              meter={calls.total > 0 ? calls.qualified / calls.total : undefined}
              delta={previous ? countDelta(calls.qualified, previous.calls.qualified) : undefined}
              deltaHint={comparedTo}
              onClick={calls.total > 0 ? () => setCallsDrillDown({ title: `Appels — ${periodLabel}` }) : undefined}
            />
            {/* Appels qualifiés au statut qui déclenche un dossier (« RDV pris » ou équivalent configuré) : la vraie
                activité de prise de rendez-vous, y compris pour un Agent calliste (qui ne crée jamais d'événement
                calendrier lui-même — l'ancienne carte comptait ces événements et restait donc à 0). */}
            <StatCard
              icon={CalendarCheck}
              label="Rendez-vous pris"
              value={calls.conversion.triggeringCount}
              detail="appels qualifiés « RDV pris »"
              delta={previous ? countDelta(calls.conversion.triggeringCount, previous.calls.conversion.triggeringCount) : undefined}
              deltaHint={comparedTo}
              onClick={calls.conversion.triggeringCount > 0 ? openConversionDrillDown : undefined}
            />
            <StatCard
              icon={FolderPlus}
              label="Nouveaux dossiers"
              value={clients.total}
              detail="créés sur la période"
              delta={previous ? countDelta(clients.total, previous.clients.total) : undefined}
              deltaHint={comparedTo}
              onClick={clients.total > 0 ? () => setShowClientsDrillDown(true) : undefined}
            />
            <StatCard
              icon={Target}
              label="Taux de conversion"
              value={formatConversionRate(calls.conversion.rate)}
              detail={`${plural(calls.conversion.triggeringCount, "appel")} concluant${calls.conversion.triggeringCount > 1 ? "s" : ""}`}
              meter={calls.conversion.rate}
              delta={previous ? rateDelta(calls.conversion.rate, previous.calls.conversion.rate) : undefined}
              deltaHint={comparedTo}
              onClick={calls.conversion.triggeringCount > 0 ? openConversionDrillDown : undefined}
            />
          </div>

          {showByDay ? (
            <ChartCard
              title="Appels qualifiés par jour"
              aside={
                bestDay ? (
                  <>
                    Meilleur jour : <span className="font-medium text-ink">{formatDay(bestDay.date)}</span> ·{" "}
                    {plural(bestDay.count, "appel")}
                  </>
                ) : null
              }
            >
              {bestDay ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={byDayChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip cursor={{ stroke: "var(--color-ink-faint)", strokeWidth: 1 }} content={<DayTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-forest-600)"
                      strokeWidth={2}
                      fill="var(--color-forest-600)"
                      fillOpacity={0.1}
                      activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Aucun appel qualifié sur cette période." />
              )}
            </ChartCard>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartCard
                title="Appels qualifiés par heure"
                aside={
                  peakHour ? (
                    <>
                      Pic à <span className="font-mono font-medium text-ink">{peakHour.hour}h</span> ·{" "}
                      {plural(peakHour.count, "appel")}
                    </>
                  ) : null
                }
              >
                {peakHour ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byHourChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--color-border)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip cursor={{ fill: "var(--color-surface-subtle)" }} content={<HourTooltip />} />
                      <Bar dataKey="count" fill="var(--color-forest-600)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="Aucun appel qualifié sur cette période."
                    description="Le graphique se remplit dès qu'un appel est qualifié depuis la file À appeler."
                  />
                )}
              </ChartCard>
            </div>

            {/* Colonne de droite : répartitions empilées ; la première s'étire pour s'aligner sur le graphique. */}
            <div className="flex flex-col gap-4">
              <div className="flex-1">
                <ChartCard title="Appels par statut" aside={byStatusTotal > 0 ? plural(byStatusTotal, "appel") : null}>
                  {byStatusTotal === 0 ? (
                    <EmptyState title="Aucun appel sur cette période." />
                  ) : (
                    <BarList
                      rows={byStatusRows.map((s) => ({ key: s.statusId, label: s.label, count: s.count }))}
                      total={byStatusTotal}
                    />
                  )}
                </ChartCard>
              </div>
              {/* Masquée quand il n'y a qu'un type : une répartition à 100 % n'apprend rien. */}
              {byTypeRows.length > 1 ? (
                <div>
                  <ChartCard title="Appels par type" aside={plural(byTypeTotal, "appel")}>
                    <BarList
                      rows={byTypeRows.map((t) => ({
                        key: t.type,
                        label: CALL_TYPE_LABELS[t.type as CallType] ?? t.type,
                        count: t.count,
                      }))}
                      total={byTypeTotal}
                    />
                  </ChartCard>
                </div>
              ) : null}
            </div>
          </div>

          {/* Vue globale seulement (/admin/dashboard) : la performance de l'équipe, agent par agent —
              `byUser` est déjà renvoyé par GET /reports/calls, jamais affiché avant. */}
          {!userId ? <TeamPerformanceCard byUser={calls.byUser} /> : null}
        </div>
      )}

      {/* §6.13 — la portée hérite du contexte déjà affiché sur la carte : userId absent = vue globale
          (/admin/dashboard, calls.viewAll côté backend) ; userId renseigné = ce collègue précis (agent
          lui-même ou choisi via le sélecteur sur /my-stats), jamais recalculée ici. */}
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

/** Info-bulle du graphique horaire, aux couleurs de l'app (lisible en clair comme en sombre). */
function HourTooltip({ active, payload }: { active?: boolean; payload?: { value?: number; payload?: { hour: number } }[] }) {
  const item = payload?.[0];
  if (!active || !item?.payload) return null;
  const count = item.value ?? 0;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="font-mono text-ink-muted">
        {item.payload.hour}h – {item.payload.hour + 1}h
      </p>
      <p className="mt-0.5 font-medium text-ink">
        {plural(count, "appel")} qualifié{count > 1 ? "s" : ""}
      </p>
    </div>
  );
}

/** Info-bulle du graphique par jour. */
function DayTooltip({ active, payload }: { active?: boolean; payload?: { value?: number; payload?: { date: string } }[] }) {
  const item = payload?.[0];
  if (!active || !item?.payload) return null;
  const count = item.value ?? 0;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-raised">
      <p className="text-ink-muted first-letter:uppercase">{formatDay(item.payload.date, true)}</p>
      <p className="mt-0.5 font-medium text-ink">
        {plural(count, "appel")} qualifié{count > 1 ? "s" : ""}
      </p>
    </div>
  );
}

/**
 * Répartition par catégorie : une barre par ligne, triée, même teinte (une seule série — la longueur porte
 * la grandeur, le libellé porte l'identité). Chiffre et part affichés en clair, jamais par la couleur seule.
 */
export function BarList({ rows, total }: { rows: { key: string; label: string; count: number }[]; total: number }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key} className="group text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-ink">{row.label}</span>
            <span className="shrink-0 font-mono tabular-nums text-ink">
              {row.count}
              <span className="ml-2 inline-block w-10 text-right text-xs text-ink-muted">
                {Math.round((row.count / total) * 100)}%
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-sm bg-surface-subtle">
            <div
              className="h-1.5 rounded-sm bg-forest-600 transition-[width] duration-300 ease-out group-hover:bg-forest-700"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Exporté — réutilisé par le tableau de bord Agent RDV (§5.27), mêmes tuiles/graphiques. */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  meter,
  delta,
  deltaHint,
  lowerIsBetter = false,
  onClick,
}: {
  label: string;
  value: number | string;
  detail?: string;
  /** Repère visuel de la tuile (décoratif). */
  icon?: LucideIcon;
  /** Part entre 0 et 1, affichée en fine jauge sous le chiffre (ex. taux de conversion). */
  meter?: number;
  /** Tendance par rapport à la période précédente : flèche + texte, jamais la couleur seule. */
  delta?: StatDelta;
  /** Précise à quoi la tendance se compare (ex. "vs période précédente"). */
  deltaHint?: string;
  /** Une baisse est une bonne nouvelle (refus, rendez-vous manqués) : les couleurs de la tendance s'inversent. */
  lowerIsBetter?: boolean;
  /** §6.13 — drill-down KPI : présent seulement quand un clic ouvre effectivement une liste (ex. jamais sur "Taux de conversion" tant que son drill-down n'est pas branché). */
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {Icon ? (
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-forest-50 text-forest-600"
          >
            <Icon size={16} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink">{value}</p>
      {meter !== undefined ? (
        <div className="mt-3 h-1 rounded-sm bg-surface-subtle" aria-hidden>
          <div
            className="h-1 rounded-sm bg-forest-600 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(Math.max(meter, 0), 1) * 100}%` }}
          />
        </div>
      ) : null}
      {detail ? <p className="mt-2 text-xs text-ink-muted">{detail}</p> : null}
      {delta ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-medium",
              delta.direction === (lowerIsBetter ? "down" : "up") && "bg-status-success/10 text-status-success",
              delta.direction === (lowerIsBetter ? "up" : "down") && "bg-status-danger/10 text-status-danger",
              delta.direction === "flat" && "bg-surface-subtle text-ink-muted",
            )}
          >
            {delta.direction === "up" ? <ArrowUpRight size={12} aria-hidden /> : null}
            {delta.direction === "down" ? <ArrowDownRight size={12} aria-hidden /> : null}
            {delta.direction === "flat" ? <Minus size={12} aria-hidden /> : null}
            {delta.label}
          </span>
          {deltaHint ? <span className="text-ink-muted">{deltaHint}</span> : null}
        </p>
      ) : null}
      {onClick ? (
        <span
          aria-hidden
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-forest-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          Voir la liste <ArrowUpRight size={12} />
        </span>
      ) : null}
    </>
  );

  if (!onClick) {
    return <div className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-flat">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 text-left shadow-flat transition-colors hover:border-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
    >
      {content}
    </button>
  );
}

function TeamPerformanceCard({ byUser }: { byUser: CallsReportDTO["byUser"] }) {
  const rows = [...byUser].sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <ChartCard title="Performance de l'équipe — appels par agent" aside={total > 0 ? plural(total, "appel") : null}>
      {rows.length === 0 ? (
        <EmptyState title="Aucun appel sur la période." />
      ) : (
        <BarList
          rows={rows.map((row) => ({
            key: row.userId,
            label: row.user ? `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() || "—" : "—",
            count: row.count,
          }))}
          total={total}
        />
      )}
    </ChartCard>
  );
}

export function ChartCard({
  title,
  aside,
  children,
}: {
  title: string;
  /** Résumé court à droite du titre (ex. "Pic à 14h · 12 appels"). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-lg border border-border bg-surface p-5 shadow-flat">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {aside ? <p className="text-xs text-ink-muted">{aside}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Même silhouette que le contenu chargé : 4 tuiles, un grand graphique, une répartition. */
/** Squelette partagé avec le tableau de bord Agent RDV (même silhouette : 4 tuiles, un graphique, une répartition). */
export function OverviewSkeleton() {
  const block = "animate-pulse rounded-sm bg-surface-subtle";
  return (
    <div role="status" aria-label="Chargement…" className="relative space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border bg-surface p-5 shadow-flat">
            <div className={`h-4 w-1/2 ${block}`} />
            <div className={`h-8 w-1/3 ${block}`} />
            <div className={`h-3 w-2/3 ${block}`} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-flat xl:col-span-2">
          <div className={`mb-4 h-4 w-1/4 ${block}`} />
          <div className={`h-[280px] w-full ${block}`} />
        </div>
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
          <div className={`h-4 w-1/3 ${block}`} />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`h-6 w-full ${block}`} />
          ))}
        </div>
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
