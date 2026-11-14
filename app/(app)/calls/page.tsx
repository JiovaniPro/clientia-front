"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CallDetailModal } from "@/components/calls/CallDetailModal";
import { ActiveFilters, type ActiveFilter } from "@/components/ui/ActiveFilters";
import { Button } from "@/components/ui/Button";
import { CLICKABLE_ROW_CLASS, clickableRowProps } from "@/components/ui/clickableRow";
import { Input } from "@/components/ui/Input";
import { EmptyState, LoadError, TableSkeleton } from "@/components/ui/ListStates";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/Select";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageTitle } from "@/components/ui/PageTitle";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { QualifyCallModal } from "@/components/calls/QualifyCallModal";
import { ImportCallsModal } from "@/components/calls/ImportCallsModal";
import type { CallDTO, CallType, ListCallsFilters } from "@/lib/api/calls";
import { CALL_TYPE_LABELS, CALL_TYPES, deleteCall, listCalls, reassignCall, reassignCalls } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatRelative } from "@/lib/format/relativeTime";

const PAGE_SIZE = 25;

const fullName = (u: { firstName: string | null; lastName: string | null; email?: string }) =>
  `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "—";

function formatOccurredAt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function CallsPage() {
  const { authedFetch, hasPermission } = useAuth();
  const canDelete = hasPermission("calls.delete");
  // Réattribution : même permission que la vue de tous les appels (décision actée, pas de permission dédiée).
  const canReassign = hasPermission("calls.viewAll");

  const [statuses, setStatuses] = useState<ConfigurableListItemDTO[]>([]);
  const [calls, setCalls] = useState<CallDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [waveNumber, setWaveNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [qualifyingCall, setQualifyingCall] = useState<CallDTO | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CallDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAgentId, setBulkAgentId] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Échec d'une action (attribution) : bandeau au-dessus de la liste, qui reste affichée — distinct d'une erreur de chargement. */
  const [actionError, setActionError] = useState<string | null>(null);
  /** Changement d'agent choisi dans le select d'une ligne, en attente de confirmation. */
  const [reassignTarget, setReassignTarget] = useState<{ call: CallDTO; userId: string } | null>(null);
  const [detailCallId, setDetailCallId] = useState<string | null>(null);
  /** Incrémenté par "Réessayer" : recharge aussi les statuts et les agents si c'est leur chargement qui a échoué. */
  const [reloadKey, setReloadKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  /**
   * §P0.2 : "À appeler" ne montre QUE le statut neutre (le défaut de CALL_STATUS,
   * "À contacter" dans le seed) — pas un filtre optionnel parmi d'autres. Gap
   * corrigé : avant, cet écran n'appliquait aucun filtre de statut par défaut, un
   * appel qualifié (ex. "RDV pris") restait donc visible ici indéfiniment. La clé
   * réelle dépend de la config de l'organisation, jamais codée en dur.
   */
  const neutralStatusKey = statuses.find((s) => s.isDefault)?.key;

  // Débounce de la recherche — évite une requête par frappe.
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
    if (!canReassign) return;
    authedFetch((token) => listUsers({ role: "Agent calliste", isActive: true }, token))
      .then(setAgents)
      .catch(() => setError("Impossible de charger la liste des agents callistes."));
  }, [authedFetch, canReassign, reloadKey]);

  async function handleReassign(callIds: string[], userId: string) {
    setIsReassigning(true);
    setActionError(null);
    setNotice(null);
    try {
      const { count } = await authedFetch((token) =>
        callIds.length === 1 ? reassignCall(callIds[0]!, userId, token) : reassignCalls(callIds, userId, token),
      );
      const agent = agents.find((a) => a.id === userId);
      setNotice(`${count} appel${count > 1 ? "s" : ""} attribué${count > 1 ? "s" : ""} à ${agent ? fullName(agent) : "l'agent"}.`);
      setSelectedIds(new Set());
      setBulkAgentId("");
      fetchCalls();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Impossible d'attribuer ces appels.");
    } finally {
      setIsReassigning(false);
      setReassignTarget(null);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = calls.length > 0 && calls.every((c) => selectedIds.has(c.id));

  const fetchCalls = useCallback(async () => {
    if (!neutralStatusKey) return;
    setIsLoading(true);
    setError(null);
    const filters: ListCallsFilters = {
      page,
      pageSize: PAGE_SIZE,
      statusKey: neutralStatusKey,
      sort: "queue",
      ...(type ? { type: type as CallType } : {}),
      ...(waveNumber ? { waveNumber: Number(waveNumber) } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
      ...(search ? { search } : {}),
    };
    try {
      const response = await authedFetch((token) => listCalls(filters, token));
      setCalls(response.items);
      setTotal(response.total);
    } catch {
      setError("Impossible de charger la file d'appels.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, page, neutralStatusKey, type, waveNumber, from, to, search]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Message de succès : s'efface seul (il reste fermable à la main).
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);

  // Tout changement de filtre revient à la page 1.
  useEffect(() => {
    setPage(1);
  }, [type, waveNumber, from, to, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function retry() {
    setError(null);
    if (statuses.length === 0 || (canReassign && agents.length === 0)) setReloadKey((k) => k + 1);
    fetchCalls();
  }

  function resetFilters() {
    setType("");
    setWaveNumber("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
  }

  const activeFilters: ActiveFilter[] = [
    ...(search ? [{ key: "search", label: `Recherche : ${search}`, onRemove: () => setSearchInput("") }] : []),
    ...(type ? [{ key: "type", label: `Type : ${CALL_TYPE_LABELS[type as CallType]}`, onRemove: () => setType("") }] : []),
    ...(waveNumber ? [{ key: "wave", label: `Vague : ${waveNumber}`, onRemove: () => setWaveNumber("") }] : []),
    ...(from ? [{ key: "from", label: `Du : ${from.split("-").reverse().join("/")}`, onRemove: () => setFrom("") }] : []),
    ...(to ? [{ key: "to", label: `Au : ${to.split("-").reverse().join("/")}`, onRemove: () => setTo("") }] : []),
  ];

  /** Filtres du panneau repliable (hors recherche, toujours visible). Le panneau reste ouvert tant qu'un filtre est actif. */
  const secondaryFilterCount = [type, waveNumber, from, to].filter(Boolean).length;
  const filtersOpen = showFilters || secondaryFilterCount > 0;

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleDelete(call: CallDTO) {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await authedFetch((token) => deleteCall(call.id, token));
      closeDeleteModal();
      // Dernière ligne de la page courante supprimée : retour à la page précédente (le changement de page relance le fetch).
      if (calls.length === 1 && page > 1) setPage(page - 1);
      else fetchCalls();
    } catch (err) {
      // 409 (dossier client lié) : message backend affiché tel quel ; autres échecs : message générique.
      setDeleteError(err instanceof ApiError && err.status === 409 ? err.message : "Impossible de supprimer cet appel.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5 p-6">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <PageTitle parent="Prospection">À appeler</PageTitle>
            {!error && neutralStatusKey && !(isLoading && calls.length === 0) ? (
              <span className="rounded-md bg-forest-50 px-2 py-0.5 font-mono text-xs font-medium text-forest-600">
                {total} {activeFilters.length > 0 ? `résultat${total > 1 ? "s" : ""}` : "en attente"}
              </span>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm text-ink-muted">
            Les contacts encore à appeler, par vague puis par nom. Dès qu&apos;un appel est qualifié, il quitte cette
            liste et rejoint le Journal.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 whitespace-nowrap">
          <Button variant="secondary" onClick={() => setShowImportModal(true)}>
            <Upload size={16} aria-hidden />
            Importer
          </Button>
        </div>
      </header>

      {/* Barre d'outils : la recherche d'abord (le geste le plus fréquent), les filtres secondaires repliés. */}
      <div className="rounded-lg border border-border bg-surface shadow-flat">
        <div className="flex items-center gap-2 p-3">
          <div className="relative flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              aria-label="Recherche"
              placeholder="Rechercher un nom, un numéro, une note…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="calls-filters"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
              filtersOpen || secondaryFilterCount > 0
                ? "border-forest-600/40 bg-forest-50 text-forest-600"
                : "border-border bg-surface text-ink hover:bg-surface-subtle",
            )}
          >
            <SlidersHorizontal size={16} aria-hidden />
            Filtres
            {secondaryFilterCount > 0 ? (
              <span className="rounded-sm bg-forest-600 px-1.5 font-mono text-[11px] leading-5 text-white">
                {secondaryFilterCount}
              </span>
            ) : null}
            <ChevronDown size={14} aria-hidden className={cn("transition-transform", filtersOpen && "rotate-180")} />
          </button>
        </div>
        {filtersOpen ? (
          <div id="calls-filters" className="app-rise flex flex-wrap items-end gap-3 border-t border-border p-3">
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} className="w-40">
              <option value="">Tous</option>
              {CALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CALL_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
            <Input
              label="Vague"
              type="number"
              min={1}
              value={waveNumber}
              onChange={(e) => setWaveNumber(e.target.value)}
              className="w-24"
            />
            <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        ) : null}
      </div>

      <ActiveFilters filters={activeFilters} onReset={resetFilters} />

      {actionError ? (
        <p role="alert" className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {actionError}
        </p>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="app-rise flex items-center gap-2 rounded-md border border-forest-600/30 bg-forest-50 px-3 py-2 text-sm text-forest-600"
        >
          <CheckCircle2 size={16} aria-hidden className="shrink-0" />
          <p className="flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fermer le message"
            className="rounded-sm p-0.5 hover:bg-forest-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <LoadError message={error} onRetry={retry} />
        ) : isLoading && calls.length === 0 ? (
          <TableSkeleton columns={canReassign ? 8 : 6} />
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
              title="Aucun appel à passer."
              description="La file est vide : importez un fichier de contacts pour l'alimenter."
              action={
                <Button size="sm" onClick={() => setShowImportModal(true)}>
                  <Upload size={14} aria-hidden />
                  Importer un fichier →
                </Button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table
              className={cn("w-full whitespace-nowrap text-sm transition-opacity", isLoading && "opacity-60")}
              aria-busy={isLoading}
            >
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                  {canReassign ? (
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Tout sélectionner sur cette page"
                        className="h-4 w-4 cursor-pointer accent-forest-600"
                        checked={allOnPageSelected}
                        onChange={() =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            for (const c of calls) {
                              if (allOnPageSelected) next.delete(c.id);
                              else next.add(c.id);
                            }
                            return next;
                          })
                        }
                      />
                    </th>
                  ) : null}
                  <th className="px-3 py-2.5 font-medium">Contact</th>
                  <th className="px-3 py-2.5 font-medium">Téléphone</th>
                  <th className="px-3 py-2.5 font-medium">Vague</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Ajouté</th>
                  {canReassign ? <th className="px-3 py-2.5 font-medium">Agent</th> : null}
                  <th className="px-3 py-2.5 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => {
                  const isSelected = selectedIds.has(call.id);
                  const hasName = Boolean(call.firstName || call.lastName);
                  return (
                  <tr
                    key={call.id}
                    className={cn(
                      "group border-b border-border transition-colors last:border-0",
                      isSelected ? "bg-forest-50" : "hover:bg-surface-subtle",
                      CLICKABLE_ROW_CLASS,
                    )}
                    {...clickableRowProps(() => setDetailCallId(call.id))}
                  >
                    {canReassign ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner l'appel ${call.toNumber}`}
                          checked={isSelected}
                          onChange={() => toggleSelected(call.id)}
                          className="h-4 w-4 cursor-pointer accent-forest-600"
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-xs font-semibold text-ink-muted"
                        >
                          {`${call.firstName?.[0] ?? ""}${call.lastName?.[0] ?? ""}`.toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className={cn("truncate font-medium", hasName ? "text-ink" : "text-ink-muted")}>
                            {hasName ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() : "Contact sans nom"}
                          </p>
                          {call.email ? <p className="max-w-[240px] truncate text-xs text-ink-muted">{call.email}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2"><PhoneLink number={call.toNumber} /></td>
                    <td className="px-3 py-2">
                      <WaveBadge waveNumber={call.waveNumber} />
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{CALL_TYPE_LABELS[call.type]}</td>
                    <td className="px-3 py-2 text-ink-muted">
                      <time dateTime={call.occurredAt} title={formatOccurredAt(call.occurredAt)}>
                        {formatRelative(call.occurredAt)}
                      </time>
                    </td>
                    {canReassign ? (
                      <td className="px-3 py-2">
                        {/* Allégé : lu comme un texte, la bordure n'apparaît qu'au survol/focus. Le changement passe par la confirmation. */}
                        <select
                          aria-label={`Agent de l'appel ${call.toNumber}`}
                          value={call.userId}
                          disabled={isReassigning}
                          onChange={(e) => setReassignTarget({ call, userId: e.target.value })}
                          className="-ml-2 h-8 w-44 cursor-pointer truncate rounded-md border border-transparent bg-transparent px-2 text-sm text-ink transition-colors hover:border-border hover:bg-surface focus:border-forest-600 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {/* Propriétaire actuel hors des agents callistes (ex. l'admin qui a importé) : affiché, pas re-sélectionnable. */}
                          {agents.some((a) => a.id === call.userId) ? null : (
                            <option value={call.userId} disabled>
                              {call.user ? fullName(call.user) : "—"}
                            </option>
                          )}
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {fullName(a)}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Action principale de la file : discrète au repos, pleine au survol/focus de la ligne. */}
                        <button
                          type="button"
                          onClick={() => setQualifyingCall(call)}
                          className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-forest-700! hover:bg-forest-700! focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface group-hover:border-forest-600 group-hover:bg-forest-600 group-hover:text-white group-focus-within:border-forest-600 group-focus-within:bg-forest-600 group-focus-within:text-white"
                        >
                          Qualifier
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Détails"
                          title="Voir le détail de l'appel"
                          className="w-8 shrink-0 px-0!"
                          onClick={() => setDetailCallId(call.id)}
                        >
                          <Eye size={16} aria-hidden />
                        </Button>
                        {canDelete ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Supprimer"
                            title="Supprimer cet appel"
                            className="w-8 shrink-0 px-0! hover:text-status-danger"
                            onClick={() => setDeleteTarget(call)}
                          >
                            <Trash2 size={16} aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm text-ink-muted">
          <span>
            {isLoading && calls.length === 0 ? (
              <span className="inline-block h-4 w-24 animate-pulse rounded-sm bg-surface-subtle align-middle" />
            ) : total === 0 ? (
              "0 appel"
            ) : (
              <>
                <span className="font-mono text-ink">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                </span>{" "}
                sur {total} appel{total > 1 ? "s" : ""}
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} aria-hidden />
              Précédent
            </Button>
            <span className="font-mono text-xs">
              page {page} sur {totalPages}
            </span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Suivant
              <ChevronRight size={16} aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {/* Barre d'actions groupées : flotte en bas de la zone qui défile tant qu'une sélection existe. */}
      {canReassign && selectedIds.size > 0 ? (
        <div className="app-rise sticky bottom-4 z-10 mx-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-lg border border-forest-600/40 bg-surface px-4 py-2.5 text-sm shadow-raised">
          <span className="font-medium text-ink">
            {selectedIds.size} appel{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <span aria-hidden className="h-5 w-px bg-border" />
          <Select
            aria-label="Attribuer à"
            value={bulkAgentId}
            onChange={(e) => setBulkAgentId(e.target.value)}
            className="w-56"
          >
            <option value="">Attribuer à…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {fullName(a)}
              </option>
            ))}
          </Select>
          <Button size="sm" disabled={!bulkAgentId || isReassigning} onClick={() => handleReassign([...selectedIds], bulkAgentId)}>
            {isReassigning ? "Attribution…" : "Attribuer"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Annuler la sélection
          </Button>
        </div>
      ) : null}

      {qualifyingCall ? (
        <QualifyCallModal
          call={qualifyingCall}
          statuses={statuses}
          onClose={() => setQualifyingCall(null)}
          onSaved={() => {
            setQualifyingCall(null);
            fetchCalls();
          }}
        />
      ) : null}

      {detailCallId ? (
        <CallDetailModal
          callId={detailCallId}
          onClose={() => setDetailCallId(null)}
          // File "À appeler" : l'action principale du détail est la qualification (la modale de détail se ferme).
          onQualify={() => {
            const target = calls.find((c) => c.id === detailCallId);
            setDetailCallId(null);
            if (target) setQualifyingCall(target);
          }}
        />
      ) : null}

      {reassignTarget ? (
        <ConfirmModal
          title="Changer d'agent"
          message={(() => {
            const { call, userId } = reassignTarget;
            const agent = agents.find((a) => a.id === userId);
            const contact =
              call.firstName || call.lastName ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() : call.toNumber;
            return (
              <p>
                Attribuer l&apos;appel de <strong>{contact}</strong> à <strong>{agent ? fullName(agent) : "cet agent"}</strong> ?
              </p>
            );
          })()}
          confirmLabel="Attribuer"
          variant="neutral"
          onConfirm={() => handleReassign([reassignTarget.call.id], reassignTarget.userId)}
          onClose={() => setReassignTarget(null)}
          isConfirming={isReassigning}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Supprimer cet appel"
          message={
            <div className="space-y-2">
              <p>Supprimer cet appel ? Cette action est irréversible.</p>
              {deleteError ? <p className="text-status-danger">{deleteError}</p> : null}
            </div>
          }
          confirmLabel="Supprimer"
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={closeDeleteModal}
          isConfirming={isDeleting}
        />
      ) : null}

      {showImportModal ? (
        <ImportCallsModal
          onClose={() => setShowImportModal(false)}
          onImported={fetchCalls}
          agents={canReassign ? agents : undefined}
        />
      ) : null}
    </div>
  );
}
