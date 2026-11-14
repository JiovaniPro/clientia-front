"use client";

import { useCallback, useEffect, useState } from "react";
import { CallDetailModal } from "@/components/calls/CallDetailModal";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { ActiveFilters, type ActiveFilter } from "@/components/ui/ActiveFilters";
import { CLICKABLE_ROW_CLASS, clickableRowProps } from "@/components/ui/clickableRow";
import { EmptyState, LoadError, TableSkeleton } from "@/components/ui/ListStates";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { CallDTO, CallType, ListCallsFilters } from "@/lib/api/calls";
import { CALL_TYPE_LABELS, CALL_TYPES, listCalls } from "@/lib/api/calls";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";
import { PageTitle } from "@/components/ui/PageTitle";

function personLabel(p: { firstName: string | null; lastName: string | null } | null | undefined, fallback: string) {
  if (!p) return fallback;
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || fallback;
}

const PAGE_SIZE = 25;

function formatOccurredAt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * §5.6 — Journal des appels : lecture seule, tout l'historique DÉJÀ TRAITÉ. Gap
 * corrigé : cet écran n'appliquait aucun filtre de statut par défaut (montrait
 * même les appels encore "à contacter", en doublon avec §5.5) — `excludeStatusKey`
 * retire par défaut le statut neutre. Le filtre "Statut" reste disponible pour
 * affiner sur UN statut déjà traité en particulier (le statut neutre lui-même
 * n'est volontairement pas proposé dans ce filtre — c'est le rôle de "À appeler").
 */
export default function CallHistoryPage() {
  const { authedFetch, hasPermission } = useAuth();
  const canViewAll = hasPermission("calls.viewAll");

  const [statuses, setStatuses] = useState<ConfigurableListItemDTO[]>([]);
  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [calls, setCalls] = useState<CallDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusKey, setStatusKey] = useState("");
  const [type, setType] = useState("");
  const [waveNumber, setWaveNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [agentId, setAgentId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [detailCallId, setDetailCallId] = useState<string | null>(null);
  /** Incrémenté par "Réessayer" quand c'est le chargement des statuts qui a échoué. */
  const [reloadKey, setReloadKey] = useState(0);

  const neutralStatusKey = statuses.find((s) => s.isDefault)?.key;
  const treatedStatuses = statuses.filter((s) => !s.isDefault);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    authedFetch((token) => getConfigurableList("CALL_STATUS", token))
      .then(setStatuses)
      .catch(() => setError("Impossible de charger les statuts."));
  }, [authedFetch, reloadKey]);

  useEffect(() => {
    // §5.18 — la liste des agents (pour le filtre) n'a de sens qu'avec calls.viewAll ;
    // sans elle, le backend ignorerait de toute façon un userId choisi ici.
    if (!canViewAll) return;
    authedFetch((token) => listUsers({}, token))
      .then(setAgents)
      .catch(() => {});
  }, [canViewAll, authedFetch]);

  const fetchCalls = useCallback(async () => {
    if (!neutralStatusKey) return;
    setIsLoading(true);
    setError(null);
    const filters: ListCallsFilters = {
      page,
      pageSize: PAGE_SIZE,
      // Un statut choisi manuellement remplace l'exclusion par défaut, il ne s'y ajoute pas.
      ...(statusKey ? { statusKey } : { excludeStatusKey: neutralStatusKey }),
      ...(type ? { type: type as CallType } : {}),
      ...(waveNumber ? { waveNumber: Number(waveNumber) } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
      ...(search ? { search } : {}),
      ...(agentId ? { userId: agentId } : {}),
    };
    try {
      const response = await authedFetch((token) => listCalls(filters, token));
      setCalls(response.items);
      setTotal(response.total);
    } catch {
      setError("Impossible de charger le journal des appels.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, page, neutralStatusKey, statusKey, type, waveNumber, from, to, search, agentId]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    setPage(1);
  }, [statusKey, type, waveNumber, from, to, search, agentId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function retry() {
    setError(null);
    if (statuses.length === 0) setReloadKey((k) => k + 1);
    fetchCalls();
  }

  function resetFilters() {
    setStatusKey("");
    setType("");
    setWaveNumber("");
    setFrom("");
    setTo("");
    setAgentId("");
    setSearchInput("");
    setSearch("");
  }

  const selectedStatus = treatedStatuses.find((s) => s.key === statusKey);
  const selectedAgent = agents.find((a) => a.id === agentId);
  const activeFilters: ActiveFilter[] = [
    ...(search ? [{ key: "search", label: `Recherche : ${search}`, onRemove: () => setSearchInput("") }] : []),
    ...(statusKey
      ? [{ key: "status", label: `Statut : ${selectedStatus?.label ?? statusKey}`, onRemove: () => setStatusKey("") }]
      : []),
    ...(type ? [{ key: "type", label: `Type : ${CALL_TYPE_LABELS[type as CallType]}`, onRemove: () => setType("") }] : []),
    ...(agentId
      ? [
          {
            key: "agent",
            label: `Agent : ${selectedAgent ? personLabel(selectedAgent, selectedAgent.email) : "—"}`,
            onRemove: () => setAgentId(""),
          },
        ]
      : []),
    ...(waveNumber ? [{ key: "wave", label: `Vague : ${waveNumber}`, onRemove: () => setWaveNumber("") }] : []),
    ...(from ? [{ key: "from", label: `Du : ${from.split("-").reverse().join("/")}`, onRemove: () => setFrom("") }] : []),
    ...(to ? [{ key: "to", label: `Au : ${to.split("-").reverse().join("/")}`, onRemove: () => setTo("") }] : []),
  ];

  return (
    <div className="space-y-5 p-6">
      <header>
        <PageTitle parent="Prospection">Journal des appels</PageTitle>
        <p className="text-sm text-ink-muted">
          Tous les appels déjà qualifiés, avec leur dernier statut.
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
        <Select label="Statut" value={statusKey} onChange={(e) => setStatusKey(e.target.value)} className="w-44">
          <option value="">Tous les statuts traités</option>
          {treatedStatuses.map((s) => (
            <option key={s.id} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} className="w-40">
          <option value="">Tous</option>
          {CALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {CALL_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        {canViewAll ? (
          <Select label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-48">
            <option value="">Tous</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {personLabel(a, a.email)}
                {!a.isActive ? " (inactif)" : ""}
              </option>
            ))}
          </Select>
        ) : null}
        <Input
          label="Vague"
          type="number"
          value={waveNumber}
          onChange={(e) => setWaveNumber(e.target.value)}
          className="w-24"
        />
        <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      <ActiveFilters filters={activeFilters} onReset={resetFilters} />

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <LoadError message={error} onRetry={retry} />
        ) : isLoading && calls.length === 0 ? (
          <TableSkeleton columns={canViewAll ? 8 : 7} />
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
              title="Aucun appel qualifié pour l'instant."
              description="Un appel apparaît ici dès qu'il est qualifié depuis la file À appeler."
              action={
                <Link href="/calls" className={buttonClassName({ variant: "secondary", size: "sm" })}>
                  Aller à la file À appeler →
                </Link>
              }
            />
          )
        ) : (
          <table className={cn("w-full text-sm transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading}>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Vague</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Téléphone</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                {canViewAll ? <th className="px-4 py-2.5 font-medium">Agent</th> : null}
                <th className="px-4 py-2.5 font-medium">Le</th>
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
                  <td className="px-4 py-2.5">
                    <WaveBadge waveNumber={call.waveNumber} />
                  </td>
                  <td className="px-4 py-2.5 text-ink">
                    {call.firstName || call.lastName ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-2.5"><PhoneLink number={call.toNumber} /></td>
                  <td className="px-4 py-2.5 text-ink-muted">{CALL_TYPE_LABELS[call.type]}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={call.status.label} color={call.status.color} />
                  </td>
                  {canViewAll ? (
                    <td className="px-4 py-2.5 text-ink-muted">{personLabel(call.user, "—")}</td>
                  ) : null}
                  <td className="px-4 py-2.5 text-ink-muted">{formatOccurredAt(call.occurredAt)}</td>
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
