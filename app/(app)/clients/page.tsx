"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClientListItemDTO, ListClientsFilters } from "@/lib/api/clients";
import { listClients } from "@/lib/api/clients";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";

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
  const { authedFetch } = useAuth();

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
  }, [authedFetch]);

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

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.7</p>
        <h1 className="font-display text-2xl font-bold text-ink">Mes dossiers clients</h1>
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

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <p className="p-6 text-sm text-status-danger">{error}</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Chargement…</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Aucun dossier ne correspond à ces filtres.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Téléphone</th>
                <th className="px-4 py-2.5 font-medium">Statut dossier</th>
                <th className="px-4 py-2.5 font-medium">Statut final</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Télephoniste</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                  <td className="px-4 py-2.5 text-ink">
                    {client.firstName || client.lastName
                      ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-forest-600">{client.phoneNumber}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={client.dossierStatus.label} color={client.dossierStatus.color} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={client.finalStatus.label} color={client.finalStatus.color} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{personLabel(client.agent)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{personLabel(client.telephoniste)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/clients/${client.id}`}>
                      <Button size="sm" variant="secondary">
                        Ouvrir
                      </Button>
                    </Link>
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
    </div>
  );
}
