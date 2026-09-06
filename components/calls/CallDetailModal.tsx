"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CallDetailDTO } from "@/lib/api/calls";
import { getCall } from "@/lib/api/calls";
import { useAuth } from "@/lib/auth/AuthContext";

interface CallDetailModalProps {
  callId: string;
  onClose: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function personLabel(p: { firstName: string | null; lastName: string | null } | null | undefined) {
  if (!p) return "—";
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—";
}

/** §5.6 — lecture seule : le journal ne propose pas d'action de qualification, seulement l'historique. */
export function CallDetailModal({ callId, onClose }: CallDetailModalProps) {
  const { authedFetch } = useAuth();
  const [call, setCall] = useState<CallDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch((token) => getCall(callId, token))
      .then(setCall)
      .catch(() => setError("Impossible de charger le détail de cet appel."));
  }, [authedFetch, callId]);

  return (
    <Modal title={call ? `Appel — ${call.toNumber}` : "Appel"} onClose={onClose} widthClassName="max-w-lg">
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}
      {!call && !error ? <p className="text-sm text-ink-muted">Chargement…</p> : null}
      {call ? (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-muted">Contact</dt>
            <dd className="text-ink">
              {call.firstName || call.lastName ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() : "—"}
            </dd>
            <dt className="text-ink-muted">Téléphone</dt>
            <dd className="font-mono text-forest-600">{call.toNumber}</dd>
            <dt className="text-ink-muted">Type</dt>
            <dd className="text-ink">{call.type}</dd>
            <dt className="text-ink-muted">Statut actuel</dt>
            <dd>
              <StatusBadge label={call.status.label} color={call.status.color} />
            </dd>
            <dt className="text-ink-muted">Vague</dt>
            <dd className="text-ink">{call.waveNumber ?? "—"}</dd>
            <dt className="text-ink-muted">Le</dt>
            <dd className="text-ink">{formatDateTime(call.occurredAt)}</dd>
            {call.recallDate ? (
              <>
                <dt className="text-ink-muted">Rappel</dt>
                <dd className="text-ink">
                  {formatDateTime(call.recallDate)} {call.recallTimeSlot ? `· ${call.recallTimeSlot}` : ""}
                </dd>
              </>
            ) : null}
            {call.notes ? (
              <>
                <dt className="text-ink-muted">Notes</dt>
                <dd className="text-ink">{call.notes}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">Dossier client</dt>
            <dd className="text-ink">{call.client ? "Oui" : "Non"}</dd>
          </dl>

          <div>
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">Historique des statuts</h3>
            {call.statusHistory.length === 0 ? (
              <p className="text-sm text-ink-muted">Aucun changement de statut enregistré.</p>
            ) : (
              <ul className="space-y-2 border-l border-border pl-3">
                {call.statusHistory.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <div className="flex items-center gap-1.5">
                      {entry.oldStatus ? (
                        <>
                          <StatusBadge label={entry.oldStatus.label} color={entry.oldStatus.color} />
                          <span className="text-ink-faint">→</span>
                        </>
                      ) : null}
                      <StatusBadge label={entry.newStatus.label} color={entry.newStatus.color} />
                    </div>
                    <p className="text-xs text-ink-muted">
                      {formatDateTime(entry.changedAt)} par {personLabel(entry.changedBy)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
