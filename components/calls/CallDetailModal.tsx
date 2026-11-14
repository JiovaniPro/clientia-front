"use client";

import { AlarmClock, ArrowDownLeft, ArrowUpRight, FolderOpen, Mail } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/ListStates";
import { Modal } from "@/components/ui/Modal";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CallDetailDTO } from "@/lib/api/calls";
import { CALL_TYPE_LABELS, getCall } from "@/lib/api/calls";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatRelative } from "@/lib/format/relativeTime";

interface CallDetailModalProps {
  callId: string;
  onClose: () => void;
  /** Fourni par la file "À appeler" : ajoute l'action principale "Qualifier" en pied de modale. */
  onQualify?: () => void;
}

type Person = { firstName: string | null; lastName: string | null } | null | undefined;

function personLabel(p: Person, fallback = "—") {
  if (!p) return fallback;
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || fallback;
}

function initials(firstName: string | null, lastName: string | null) {
  const value = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return value || "?";
}

function formatLongDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

/** recallDate vient d'un <input type="date"> (minuit UTC) : affiché en UTC pour ne jamais décaler le jour. */
function formatRecallDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

/**
 * Détail d'un appel, ouvert depuis Aujourd'hui, À appeler et le Journal (clic sur la ligne).
 * Lecture d'abord : qui, où en est-on, prochaine étape, puis le contexte et l'historique. Seule
 * action d'écriture : "Qualifier", et uniquement quand l'écran appelant la fournit (file À appeler).
 */
export function CallDetailModal({ callId, onClose, onQualify }: CallDetailModalProps) {
  const { authedFetch } = useAuth();
  const [call, setCall] = useState<CallDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    authedFetch((token) => getCall(callId, token))
      .then((detail) => {
        setCall(detail);
        setError(null);
      })
      .catch(() => setError("Impossible de charger le détail de cet appel."));
  }, [authedFetch, callId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Modal title="Détail de l'appel" onClose={onClose} widthClassName="max-w-2xl">
      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !call ? (
        <DetailSkeleton />
      ) : (
        <CallDetailBody call={call} onClose={onClose} onQualify={onQualify} />
      )}
    </Modal>
  );
}

function CallDetailBody({ call, onClose, onQualify }: { call: CallDetailDTO; onClose: () => void; onQualify?: () => void }) {
  const hasName = Boolean(call.firstName || call.lastName);
  const DirectionIcon = call.direction === "INBOUND" ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="space-y-6">
      {/* Identité : qui, comment le joindre, où en est-on. */}
      <section className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest-50 font-display text-base font-semibold text-forest-600"
        >
          {initials(call.firstName, call.lastName)}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <h3 className="min-w-0 truncate font-display text-xl font-semibold text-ink">
              {hasName ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() : "Contact sans nom"}
            </h3>
            <span className="inline-flex items-center rounded-md border border-border bg-surface-subtle px-2 py-1">
              <StatusBadge label={call.status.label} color={call.status.color} />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <PhoneLink number={call.toNumber} />
            {call.email ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-ink-muted">
                <Mail size={14} aria-hidden className="shrink-0" />
                <span className="truncate">{call.email}</span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <DirectionIcon size={13} aria-hidden />
              {call.direction === "INBOUND" ? "Entrant" : "Sortant"}
            </span>
            <span aria-hidden className="text-ink-faint">·</span>
            <span>{CALL_TYPE_LABELS[call.type]}</span>
            {call.waveNumber !== null ? (
              <>
                <span aria-hidden className="text-ink-faint">·</span>
                <WaveBadge waveNumber={call.waveNumber} />
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* Prochaine étape : rappel planifié et/ou dossier client — ce qu'on vient chercher le plus souvent. */}
      {call.recallDate || call.client ? (
        <section aria-label="Prochaine étape" className="grid gap-3 sm:grid-cols-2">
          {call.recallDate ? (
            <div className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
              <AlarmClock size={18} aria-hidden className="mt-0.5 shrink-0 text-status-warning" />
              <div className="text-sm">
                <p className="font-medium text-ink">Rappel prévu</p>
                <p className="text-ink-muted first-letter:uppercase">
                  {formatRecallDay(call.recallDate)}
                  {call.recallTimeSlot ? <span className="font-mono"> · {call.recallTimeSlot}</span> : null}
                </p>
              </div>
            </div>
          ) : null}
          {call.client ? (
            <Link
              href={`/clients/${call.client.id}`}
              onClick={onClose}
              className="group flex items-start gap-3 rounded-md border border-forest-600/30 bg-forest-50 p-3 transition-colors hover:border-forest-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            >
              <FolderOpen size={18} aria-hidden className="mt-0.5 shrink-0 text-forest-600" />
              <div className="text-sm">
                <p className="font-medium text-ink">Dossier client</p>
                <p className="text-forest-600 group-hover:underline">Ouvrir le dossier →</p>
              </div>
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* Contexte de l'appel. */}
      <section aria-labelledby="call-detail-context">
        <h4 id="call-detail-context" className="mb-2 text-sm font-semibold text-ink">
          Informations
        </h4>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-border p-4 text-sm sm:grid-cols-2">
          <DetailItem label="Agent">{personLabel(call.user)}</DetailItem>
          <DetailItem label="Date de l'appel">{formatLongDateTime(call.occurredAt)}</DetailItem>
          {/* Jamais qualifié : lastStatusChangedAt n'est que la date d'import — ne pas la présenter comme une qualification. */}
          {call.statusHistory.length > 0 ? (
            <DetailItem label="Dernière qualification">
              {formatLongDateTime(call.lastStatusChangedAt)}
              <span className="block text-xs text-ink-muted">{formatRelative(call.lastStatusChangedAt)}</span>
            </DetailItem>
          ) : null}
          {call.durationSec ? <DetailItem label="Durée">{formatDuration(call.durationSec)}</DetailItem> : null}
          {call.fromNumber ? (
            <DetailItem label="Numéro sortant">
              <span className="font-mono">{call.fromNumber}</span>
            </DetailItem>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="call-detail-notes">
        <h4 id="call-detail-notes" className="mb-2 text-sm font-semibold text-ink">
          Notes
        </h4>
        {call.notes ? (
          <p className="whitespace-pre-wrap rounded-md bg-surface-subtle p-4 text-sm leading-relaxed text-ink [text-wrap:pretty]">
            {call.notes}
          </p>
        ) : (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-ink-muted">
            Aucune note sur cet appel.{onQualify ? " Vous pouvez en ajouter en le qualifiant." : ""}
          </p>
        )}
      </section>

      <section aria-labelledby="call-detail-history">
        <h4 id="call-detail-history" className="mb-3 text-sm font-semibold text-ink">
          Historique des statuts
          {call.statusHistory.length > 0 ? (
            <span className="ml-1.5 font-mono text-xs font-normal text-ink-muted">{call.statusHistory.length}</span>
          ) : null}
        </h4>
        {call.statusHistory.length === 0 ? (
          <p className="text-sm text-ink-muted">Pas encore qualifié : aucun changement de statut enregistré.</p>
        ) : (
          <ol className="space-y-4">
            {call.statusHistory.map((entry, index) => (
              <li key={entry.id} className="relative flex gap-3">
                {/* Fil vertical de la frise, du point de cette étape jusqu'à la suivante. */}
                {index < call.statusHistory.length - 1 ? (
                  <span aria-hidden className="absolute -bottom-4 left-[5px] top-4 w-px bg-border" />
                ) : null}
                <span
                  aria-hidden
                  className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-surface"
                  style={{ backgroundColor: entry.newStatus.color ?? "var(--color-status-neutral)" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {/* Le point coloré de la frise porte déjà la couleur du statut : libellé seul, pas de 2e point. */}
                    <span className="text-sm font-medium text-ink">{entry.newStatus.label}</span>
                    {index === 0 ? (
                      <span className="rounded-sm bg-forest-50 px-1.5 py-0.5 text-[11px] font-medium text-forest-600">
                        Actuel
                      </span>
                    ) : null}
                    {entry.oldStatus ? (
                      <span className="text-xs text-ink-muted">depuis « {entry.oldStatus.label} »</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    <time dateTime={entry.changedAt} title={formatLongDateTime(entry.changedAt)}>
                      {formatRelative(entry.changedAt)}
                    </time>{" "}
                    · par {personLabel(entry.changedBy)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Collé au bas de la zone qui défile (padding p-5 de Modal compensé) : les actions restent visibles. */}
      <div className="sticky -bottom-5 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-surface px-5 py-3">
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
        {onQualify ? <Button onClick={onQualify}>Qualifier l&apos;appel</Button> : null}
      </div>
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

/** Même silhouette que le contenu chargé (identité, deux blocs, informations) : la modale ne change pas de taille. */
function DetailSkeleton() {
  const bar = "animate-pulse rounded-sm bg-surface-subtle";
  return (
    <div role="status" aria-label="Chargement…" className="relative space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-surface-subtle" />
        <div className="flex-1 space-y-2">
          <div className={`h-6 w-2/5 ${bar}`} />
          <div className={`h-4 w-1/3 ${bar}`} />
          <div className={`h-3 w-1/4 ${bar}`} />
        </div>
      </div>
      <div className={`h-16 w-full ${bar}`} />
      <div className="grid grid-cols-2 gap-4 rounded-md border border-border p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className={`h-3 w-1/3 ${bar}`} />
            <div className={`h-4 w-2/3 ${bar}`} />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
