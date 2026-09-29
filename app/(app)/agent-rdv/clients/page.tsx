"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SendEmailModal } from "@/components/clients/SendEmailModal";
import type { ClientListItemDTO } from "@/lib/api/clients";
import { listClients } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 25;

function clientName(c: ClientListItemDTO) {
  return c.firstName || c.lastName ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : "—";
}

function formatNextAppointment(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * §5.26 "Mes clients" — version simplifiée de /clients pour l'Agent RDV : déjà
 * scopé côté backend à ses propres dossiers assignés (clientsService.listClients,
 * sans clients.viewAll), sans les filtres statut/agent de l'écran générique (peu
 * utiles pour une poignée de dossiers assignés à une seule personne). Valeur
 * ajoutée réelle par rapport à /clients : la colonne "Prochain RDV" (nouvelle,
 * voir lib/api/clients.ts) et l'envoi d'e-mail directement depuis la ligne, sans
 * ouvrir le dossier.
 */
export default function AgentRdvClientsPage() {
  const { authedFetch } = useAuth();

  const [clients, setClients] = useState<ClientListItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [emailTarget, setEmailTarget] = useState<ClientListItemDTO | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authedFetch((token) =>
        listClients({ page, pageSize: PAGE_SIZE, ...(search ? { search } : {}) }, token),
      );
      setClients(response.items);
      setTotal(response.total);
    } catch {
      setError("Impossible de charger vos dossiers clients.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, page, search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: AdminTableColumn<ClientListItemDTO>[] = [
    { header: "Client", className: "text-ink", cell: (c) => clientName(c) },
    { header: "Téléphone", className: "font-mono text-forest-600", cell: (c) => c.phoneNumber },
    { header: "Prochain RDV", className: "text-ink-muted", cell: (c) => formatNextAppointment(c.nextAppointmentAt) },
    {
      header: "Statut dossier",
      cell: (c) => <StatusBadge label={c.dossierStatus.label} color={c.dossierStatus.color} />,
    },
    {
      header: "Statut final",
      cell: (c) => <StatusBadge label={c.finalStatus.label} color={c.finalStatus.color} />,
    },
    {
      header: "",
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="text-xs font-medium text-forest-600 hover:underline disabled:opacity-40"
            onClick={() => setEmailTarget(c)}
            disabled={!c.email}
            title={c.email ? undefined : "Ce client n'a pas d'adresse e-mail"}
          >
            Envoyer un e-mail
          </button>
          <Link href={`/clients/${c.id}`} className="text-xs font-medium text-forest-600 hover:underline">
            Ouvrir
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.26</p>
        <h1 className="font-display text-2xl font-bold text-ink">Mes clients</h1>
        <p className="text-sm text-ink-muted">Les dossiers dont vous êtes l&apos;agent RDV assigné.</p>
      </header>

      <div className="max-w-xs">
        <Input
          label="Recherche"
          placeholder="Nom, téléphone, e-mail…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        <AdminTable
          columns={columns}
          rows={clients}
          rowKey={(c) => c.id}
          isLoading={isLoading}
          emptyMessage="Aucun dossier ne correspond à ces filtres."
        />

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

      {emailTarget ? (
        <SendEmailModal
          clientId={emailTarget.id}
          clientEmail={emailTarget.email}
          onClose={() => setEmailTarget(null)}
          onSent={() => {}}
        />
      ) : null}
    </div>
  );
}
