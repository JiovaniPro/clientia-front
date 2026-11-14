"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { ActiveFilters, type ActiveFilter } from "@/components/ui/ActiveFilters";
import { Button, buttonClassName } from "@/components/ui/Button";
import { CLICKABLE_ROW_CLASS, clickableRowProps } from "@/components/ui/clickableRow";
import { Input } from "@/components/ui/Input";
import { EmptyState, LoadError, TableSkeleton } from "@/components/ui/ListStates";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/Select";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClientListItemDTO, ListClientsFilters } from "@/lib/api/clients";
import { listClients } from "@/lib/api/clients";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";
import { PageTitle } from "@/components/ui/PageTitle";

const PAGE_SIZE = 25;

function personLabel(p: { firstName: string | null; lastName: string | null } | null | undefined) {
  if (!p) return "—";
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—";
}

/**
 * §5.7 — "Mes dossiers" : le backend scope automatiquement à télephoniste=moi OU
 * agent=moi tant que l'utilisateur n'a pas clients.viewAll (voir listClients côté
 * backend) — pas besoin de le refaire ici. `agentId` est maintenant un sélecteur par
 * nom (liste des Agent RDV actifs via GET /users) — corrigé avant le lot 5, c'était
 * un champ ID brut faute d'endpoint /users.
 */
export default function ClientsPage() {
  const { authedFetch, hasPermission } = useAuth();
  const router = useRouter();
  const canDelete = hasPermission("clients.delete");

  const [dossierStatuses, setDossierStatuses] = useState<ConfigurableListItemDTO[]>([]);
  const [finalStatuses, setFinalStatuses] = useState<ConfigurableListItemDTO[]>([]);
  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [clients, setClients] = useState<ClientListItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dossierStatusKey, setDossierStatusKey] = useState("");
  const [finalStatusKey, setFinalStatusKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  /** Incrémenté par "Réessayer" quand c'est le chargement des listes de statuts ou des agents qui a échoué. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    Promise.all([
      authedFetch((token) => getConfigurableList("CLIENT_DOSSIER_STATUS", token)),
      authedFetch((token) => getConfigurableList("CLIENT_FINAL_STATUS", token)),
    ])
      .then(([dossier, final]) => {
        setDossierStatuses(dossier);
        setFinalStatuses(final);
      })
      .catch(() => setError("Impossible de charger les listes de statuts."));

    authedFetch((token) => listUsers({ role: "Agent RDV" }, token))
      .then(setAgents)
      .catch(() => setError("Impossible de charger la liste des agents."));
  }, [authedFetch, reloadKey]);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const filters: ListClientsFilters = {
      page,
      pageSize: PAGE_SIZE,
      ...(dossierStatusKey ? { dossierStatusKey } : {}),
      ...(finalStatusKey ? { finalStatusKey } : {}),
      ...(agentId ? { agentId } : {}),
      ...(search ? { search } : {}),
    };
    try {
      const response = await authedFetch((token) => listClients(filters, token));
      setClients(response.items);
      setTotal(response.total);
    } catch {
      setError("Impossible de charger les dossiers.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, page, dossierStatusKey, finalStatusKey, agentId, search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    setPage(1);
  }, [dossierStatusKey, finalStatusKey, agentId, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function retry() {
    setError(null);
    if (dossierStatuses.length === 0 || agents.length === 0) setReloadKey((k) => k + 1);
    fetchClients();
  }

  function resetFilters() {
    setDossierStatusKey("");
    setFinalStatusKey("");
    setAgentId("");
    setSearchInput("");
    setSearch("");
  }

  const selectedAgent = agents.find((a) => a.id === agentId);
  const activeFilters: ActiveFilter[] = [
    ...(search ? [{ key: "search", label: `Recherche : ${search}`, onRemove: () => setSearchInput("") }] : []),
    ...(dossierStatusKey
      ? [
          {
            key: "dossier",
            label: `Statut dossier : ${dossierStatuses.find((s) => s.key === dossierStatusKey)?.label ?? dossierStatusKey}`,
            onRemove: () => setDossierStatusKey(""),
          },
        ]
      : []),
    ...(finalStatusKey
      ? [
          {
            key: "final",
            label: `Statut final : ${finalStatuses.find((s) => s.key === finalStatusKey)?.label ?? finalStatusKey}`,
            onRemove: () => setFinalStatusKey(""),
          },
        ]
      : []),
    ...(agentId
      ? [{ key: "agent", label: `Agent : ${selectedAgent ? personLabel(selectedAgent) : "—"}`, onRemove: () => setAgentId("") }]
      : []),
  ];

  return (
    <div className="space-y-5 p-6">
      <header>
        <PageTitle parent="Clients">Mes dossiers clients</PageTitle>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-flat">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Recherche"
            placeholder="Nom, téléphone, e-mail…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          label="Statut dossier"
          value={dossierStatusKey}
          onChange={(e) => setDossierStatusKey(e.target.value)}
          className="w-48"
        >
          <option value="">Tous</option>
          {dossierStatuses.map((s) => (
            <option key={s.id} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select
          label="Statut final"
          value={finalStatusKey}
          onChange={(e) => setFinalStatusKey(e.target.value)}
          className="w-48"
        >
          <option value="">Tous</option>
          {finalStatuses.map((s) => (
            <option key={s.id} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-48">
          <option value="">Tous</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || a.email}
              {a.isActive ? "" : " (inactif)"}
            </option>
          ))}
        </Select>
      </div>

      <ActiveFilters filters={activeFilters} onReset={resetFilters} />

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <LoadError message={error} onRetry={retry} />
        ) : isLoading && clients.length === 0 ? (
          <TableSkeleton columns={7} />
        ) : clients.length === 0 ? (
          activeFilters.length > 0 ? (
            <EmptyState
              title="Aucun dossier ne correspond à ces filtres."
              action={
                <Button size="sm" variant="secondary" onClick={resetFilters}>
                  Réinitialiser les filtres
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Aucun dossier client pour l'instant."
              description="Un dossier est créé quand un appel est qualifié avec un statut de prise de rendez-vous."
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
                <th className="px-4 py-2.5 font-medium">Statut dossier</th>
                <th className="px-4 py-2.5 font-medium">Statut final</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Téléphoniste</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className={cn("border-b border-border last:border-0 hover:bg-surface-subtle", CLICKABLE_ROW_CLASS)}
                  {...clickableRowProps(() => router.push(`/clients/${client.id}`))}
                >
                  <td className="px-4 py-2.5 text-ink">
                    {client.firstName || client.lastName
                      ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5"><PhoneLink number={client.phoneNumber} /></td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={client.dossierStatus.label} color={client.dossierStatus.color} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={client.finalStatus.label} color={client.finalStatus.color} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{personLabel(client.agent)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{personLabel(client.telephoniste)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/clients/${client.id}`} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                        Ouvrir
                      </Link>
                      {canDelete ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTargetId(client.id)}>
                          Supprimer
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-ink-muted">
          <span>
            {total} dossier{total > 1 ? "s" : ""}
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

      {deleteTargetId ? (
        <DeleteClientDialog
          clientId={deleteTargetId}
          onClose={() => setDeleteTargetId(null)}
          onDeleted={() => {
            setDeleteTargetId(null);
            // Dernière ligne de la page courante supprimée : retour à la page précédente (relance le fetch).
            if (clients.length === 1 && page > 1) setPage(page - 1);
            else fetchClients();
          }}
        />
      ) : null}
    </div>
  );
}
