"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CallDetailModal } from "@/components/calls/CallDetailModal";
import { ActiveFilters, type ActiveFilter } from "@/components/ui/ActiveFilters";
import { Button, buttonClassName } from "@/components/ui/Button";
import { CLICKABLE_ROW_CLASS, clickableRowProps } from "@/components/ui/clickableRow";
import { Input } from "@/components/ui/Input";
import { EmptyState, LoadError, TableSkeleton } from "@/components/ui/ListStates";
import { StatusMultiFilter } from "@/components/calls/StatusMultiFilter";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CallDTO, ListCallsFilters } from "@/lib/api/calls";
import { listCalls } from "@/lib/api/calls";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";
import { todayRange } from "@/lib/calls/todayRange";
import { cn } from "@/lib/cn";
import { PageTitle } from "@/components/ui/PageTitle";

const PAGE_SIZE = 25;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * §5.4 — "Aujourd'hui" : appels dont le STATUT a changé aujourd'hui (changedFrom/changedTo
 * sur lastStatusChangedAt, jamais from/to sur occurredAt). Aucun filtre userId ici : la
 * portée (tout l'organisation avec calls.viewAll, sinon ses propres appels) est décidée
 * côté backend. Filtre multi-statut (StatusMultiFilter) propre à cet écran — Journal/Calls gardent volontairement leur Select mono-valeur.
 */
export default function TodayPage() {
  const { user, authedFetch, hasPermission } = useAuth();

  const [statuses, setStatuses] = useState<ConfigurableListItemDTO[]>([]);
  const [calls, setCalls] = useState<CallDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Incrémenté par "Réessayer" : relance les deux chargements ci-dessous. */
  const [reloadKey, setReloadKey] = useState(0);

  const [statusKeys, setStatusKeys] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detailCallId, setDetailCallId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    authedFetch((token) => getConfigurableList("CALL_STATUS", token))
      .then(setStatuses)
      .catch(() => setError("Impossible de charger les statuts."));
  }, [authedFetch, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    const filters: ListCallsFilters = {
      page,
      pageSize: PAGE_SIZE,
      sort: "changed",
      ...todayRange(),
      ...(statusKeys.length > 0 ? { statusKeys: statusKeys.join(",") } : {}),
      ...(search ? { search } : {}),
    };
    authedFetch((token) => listCalls(filters, token))
      .then((response) => {
        if (cancelled) return;
        setCalls(response.items);
        setTotal(response.total);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les appels du jour.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, page, statusKeys, search, reloadKey]);

  function retry() {
    setError(null);
    setIsLoading(true);
    setReloadKey((k) => k + 1);
  }

  function resetFilters() {
    setStatusKeys([]);
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const activeFilters: ActiveFilter[] = [
    ...(search ? [{ key: "search", label: `Recherche : ${search}`, onRemove: () => setSearchInput("") }] : []),
    ...statuses
      .filter((s) => statusKeys.includes(s.key))
      .map((s) => ({
        key: `status-${s.key}`,
        label: `Statut : ${s.label}`,
        onRemove: () => {
          setStatusKeys((keys) => keys.filter((k) => k !== s.key));
          setPage(1);
        },
      })),
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5 p-6">
      <header>
        <PageTitle parent="Prospection">Aujourd&apos;hui</PageTitle>
        <p className="text-sm text-ink-muted">
          Bonjour {user?.firstName ?? user?.email} — appels dont le statut a changé aujourd&apos;hui.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-flat">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Recherche"
            placeholder="Nom, téléphone, notes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <StatusMultiFilter
          statuses={statuses}
          selectedKeys={statusKeys}
          onChange={(keys) => {
            setStatusKeys(keys);
            setPage(1);
          }}
        />
      </div>

      <ActiveFilters filters={activeFilters} onReset={resetFilters} />

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <LoadError message={error} onRetry={retry} />
        ) : isLoading && calls.length === 0 ? (
          <TableSkeleton columns={6} />
        ) : calls.length === 0 ? (
          activeFilters.length > 0 ? (
            <EmptyState
              title="Aucun appel ne correspond à ces filtres."
              action={
                <Button size="sm" variant="secondary" onClick={resetFilters}>
                  Réinitialiser les filtres
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Aucun appel traité aujourd'hui."
              description="Les appels apparaissent ici dès que leur statut change dans la journée."
              action={
                hasPermission("calls.view") ? (
                  <Link href="/calls" className={buttonClassName({ variant: "secondary", size: "sm" })}>
                    Aller à la file À appeler →
                  </Link>
                ) : undefined
              }
            />
          )
        ) : (
          <table className={cn("w-full text-sm transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Téléphone</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5 font-medium">Heure</th>
                <th className="px-4 py-2.5 font-medium">Rappel</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr
                  key={call.id}
                  className={cn("border-b border-border last:border-0 hover:bg-surface-subtle", CLICKABLE_ROW_CLASS)}
                  {...clickableRowProps(() => setDetailCallId(call.id))}
                >
                  <td className="px-4 py-2.5 text-ink">
                    {call.firstName || call.lastName ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-2.5"><PhoneLink number={call.toNumber} /></td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={call.status.label} color={call.status.color} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-ink-muted">{formatTime(call.lastStatusChangedAt)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {call.hasActiveReminder ? (
                      <Bell size={16} aria-label="Rappel programmé" role="img" />
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDetailCallId(call.id)}>
                      Détails
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-ink-muted">
          <span>
            {total} appel{total > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="font-mono text-xs">
              page {page} sur {totalPages}
            </span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      </div>

      {detailCallId ? <CallDetailModal callId={detailCallId} onClose={() => setDetailCallId(null)} /> : null}
    </div>
  );
}
