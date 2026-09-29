"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CallDTO } from "@/lib/api/calls";
import { listCalls } from "@/lib/api/calls";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 25;

interface CallsListModalProps {
  /** Fourni par l'écran appelant — inclut déjà le contexte affiché sur la carte source (ex. "Appels — 7 derniers jours", "Taux de conversion — appels concluants"). */
  title: string;
  from: string;
  to: string;
  /** §6.13 — portée héritée telle quelle de la carte source, jamais recalculée ici : absent = ce que calls.viewAll autorise déjà pour l'appelant ; renseigné = un collègue précis. */
  userId?: string;
  /** Union de statuts (déjà résolus en clés par l'appelant, ex. les statuts "déclenchants" pour le taux de conversion) — absent = tous statuts, comme le total affiché sur la carte "Appels". */
  statusKeys?: string[];
  onClose: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * §6.13 — drill-down KPI pour les appels : liste en lecture seule des appels qui composent un chiffre de
 * carte (Appels / appels concluants du taux de conversion…), réutilisant `GET /calls` sans nouvel endpoint.
 * Composant sœur de `AppointmentsListModal` (même patron visuel/pagination), pas le même composant : les
 * deux endpoints ont des formes de réponse et des filtres trop différents (DTO, colonnes affichées) pour
 * qu'une fusion apporte autre chose que des props génériques peu lisibles pour deux appelants.
 *
 * Contrairement à `AppointmentsListModal`, la pagination est SERVEUR (page/pageSize envoyés à `GET /calls`,
 * qui les supporte déjà nativement) — pas de raison de reconstruire une pagination client ici.
 */
export function CallsListModal({ title, from, to, userId, statusKeys, onClose }: CallsListModalProps) {
  const { authedFetch } = useAuth();

  const [calls, setCalls] = useState<CallDTO[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await authedFetch((token) =>
          listCalls(
            {
              from,
              to,
              page,
              pageSize: PAGE_SIZE,
              ...(userId ? { userId } : {}),
              ...(statusKeys && statusKeys.length > 0 ? { statusKeys: statusKeys.join(",") } : {}),
            },
            token,
          ),
        );
        if (cancelled) return;
        setCalls(response.items);
        setTotal(response.total);
      } catch {
        if (!cancelled) setError("Impossible de charger le détail de ces appels.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // statusKeys est un tableau recréé à chaque rendu côté appelant — comparé par référence casserait le
    // fetch ; seul son CONTENU (joint en chaîne) doit déclencher une nouvelle demande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch, from, to, userId, page, statusKeys?.join(",")]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-lg">
      {error ? (
        <p className="text-sm text-status-danger">{error}</p>
      ) : !calls ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : calls.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun appel sur cette période.</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border">
            {calls.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-ink">
                    {c.firstName || c.lastName ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.toNumber}
                  </p>
                  <p className="text-xs text-ink-muted">{formatDateTime(c.occurredAt)}</p>
                </div>
                <StatusBadge label={c.status.label} color={c.status.color} />
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-ink-muted">
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
      )}
    </Modal>
  );
}
