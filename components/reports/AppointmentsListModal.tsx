"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { APPOINTMENT_STATUS_LABELS } from "@/components/reports/ReportsOverview";
import type { AppointmentStatus, CalendarEventDTO } from "@/lib/api/calendar";
import { listEvents } from "@/lib/api/calendar";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 25;

interface AppointmentsListModalProps {
  /** Fourni par l'écran appelant — inclut déjà la période/le contexte affiché sur la carte source (ex. "Rendez-vous du 1 au 30 sept", "RDV à venir (7 jours)"). */
  title: string;
  from: string;
  to: string;
  /**
   * §6.13 — portée héritée telle quelle de la carte source, jamais recalculée ici : absent = ce que
   * `eventAccessFilter` autorise déjà pour l'appelant (org entière avec calendar.viewAll, sinon
   * soi-même) ; renseigné = un collègue précis (ex. admin consultant /my-stats pour cet agent).
   */
  agentRdvId?: string;
  /** Filtre CLIENT-SIDE (GET /calendar-events n'a pas de paramètre statut) — ex. ACTIVE_APPOINTMENT_STATUSES pour "RDV à venir", ["REFUSE"] pour "Refusés". Absent = tous statuts. */
  statusFilter?: AppointmentStatus[];
  onClose: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * §6.13 — drill-down KPI générique pour les rendez-vous : liste en lecture seule des RDV qui composent un
 * chiffre de carte (Rendez-vous / RDV à venir / Refusés…), réutilisant `GET /calendar-events` sans nouvel
 * endpoint. Généralisation de l'ancienne `PeriodDetailModal` (§5.28, un seul appelant à l'origine) — même
 * mécanisme, renommée car elle sert maintenant plusieurs cartes au-delà du tableau "Détail du suivi".
 *
 * Pagination CLIENT-SIDE (page ~25, motif Précédent/Suivant identique à history/page.tsx) : l'endpoint
 * calendrier calcule des occurrences récurrentes en mémoire et n'est pas paginé côté serveur — reconstruire
 * cette pagination sur le calcul de récurrence serait un chantier à part, hors périmètre d'une modale de
 * consultation dont le volume par période (une semaine/un mois d'un agent, ou même toute l'organisation)
 * reste borné. Si ce volume devient un vrai problème de performance, la pagination serveur sera à
 * reconsidérer alors — pas anticipée ici.
 */
export function AppointmentsListModal({ title, from, to, agentRdvId, statusFilter, onClose }: AppointmentsListModalProps) {
  const { authedFetch } = useAuth();

  const [events, setEvents] = useState<CalendarEventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await authedFetch((token) =>
          listEvents({ from, to, type: "APPOINTMENT", ...(agentRdvId ? { agentRdvId } : {}) }, token),
        );
        if (cancelled) return;
        const filtered = statusFilter ? data.filter((e) => e.status && statusFilter.includes(e.status)) : data;
        setEvents([...filtered].sort((a, b) => a.startAt.localeCompare(b.startAt)));
      } catch {
        if (!cancelled) setError("Impossible de charger le détail de ces rendez-vous.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // statusFilter est un tableau recréé à chaque rendu côté appelant — comparé par référence casserait le
    // fetch ; seuls from/to/agentRdvId identifient réellement une nouvelle demande de données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch, from, to, agentRdvId]);

  const total = events?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = events?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];

  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-lg">
      {error ? (
        <p className="text-sm text-status-danger">{error}</p>
      ) : !events ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun rendez-vous sur cette période.</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border">
            {pageItems.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-ink">{e.title}</p>
                  <p className="text-xs text-ink-muted">{formatDateTime(e.startAt)}</p>
                </div>
                <span className="text-xs text-ink-muted">
                  {e.status ? (APPOINTMENT_STATUS_LABELS[e.status] ?? e.status) : "—"}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-ink-muted">
            {/* "rendez-vous" est invariable en français : pas de "s" au pluriel. */}
            <span>{total} rendez-vous</span>
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
