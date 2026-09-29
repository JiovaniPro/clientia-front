"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClientListItemDTO } from "@/lib/api/clients";
import { listClients } from "@/lib/api/clients";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 25;

interface ClientsListModalProps {
  /** Fourni par l'écran appelant — inclut déjà le contexte affiché sur la carte source (ex. "Nouveaux dossiers — 7 derniers jours", "Contrats signés — ce mois"). */
  title: string;
  /** Bornes sur Client.createdAt ("Nouveaux dossiers") — absentes si le drill-down filtre plutôt sur updatedAt. */
  createdFrom?: string;
  createdTo?: string;
  /** Bornes sur Client.updatedAt ("Contrats signés" — approximation de la date de signature, voir le composant appelant). */
  updatedFrom?: string;
  updatedTo?: string;
  /** §6.13 — portée héritée telle quelle de la carte source, jamais recalculée ici : absent = ce que clients.viewAll autorise déjà pour l'appelant ; renseigné = un collègue précis. */
  agentId?: string;
  finalStatusKey?: string;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "short" });
}

/**
 * §6.13 — drill-down KPI pour les dossiers clients : liste en lecture seule des dossiers qui composent un
 * chiffre de carte (Nouveaux dossiers / Contrats signés…), réutilisant `GET /clients` sans nouvel endpoint.
 * Composant sœur de `CallsListModal`/`AppointmentsListModal` (même patron visuel), pas le même composant :
 * DTO et filtres propres aux dossiers. Pagination SERVEUR, comme `CallsListModal` — `GET /clients` la
 * supporte déjà nativement.
 */
export function ClientsListModal({
  title,
  createdFrom,
  createdTo,
  updatedFrom,
  updatedTo,
  agentId,
  finalStatusKey,
  onClose,
}: ClientsListModalProps) {
  const { authedFetch } = useAuth();

  const [clients, setClients] = useState<ClientListItemDTO[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await authedFetch((token) =>
          listClients(
            {
              page,
              pageSize: PAGE_SIZE,
              ...(createdFrom ? { createdFrom } : {}),
              ...(createdTo ? { createdTo } : {}),
              ...(updatedFrom ? { updatedFrom } : {}),
              ...(updatedTo ? { updatedTo } : {}),
              ...(agentId ? { agentId } : {}),
              ...(finalStatusKey ? { finalStatusKey } : {}),
            },
            token,
          ),
        );
        if (cancelled) return;
        setClients(response.items);
        setTotal(response.total);
      } catch {
        if (!cancelled) setError("Impossible de charger le détail de ces dossiers.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, createdFrom, createdTo, updatedFrom, updatedTo, agentId, finalStatusKey, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-lg">
      {error ? (
        <p className="text-sm text-status-danger">{error}</p>
      ) : !clients ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun dossier sur cette période.</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border">
            {clients.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-ink">
                    {c.firstName || c.lastName ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.phoneNumber}
                  </p>
                  <p className="text-xs text-ink-muted">{formatDate(updatedFrom || updatedTo ? c.updatedAt : c.createdAt)}</p>
                </div>
                <StatusBadge label={c.finalStatus.label} color={c.finalStatus.color} />
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-ink-muted">
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
      )}
    </Modal>
  );
}
