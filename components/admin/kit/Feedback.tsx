"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";

const NOTICE_MS = 5000;

/**
 * Retours d'action des écrans d'administration, en notifications flottantes (en bas à droite) : elles restent
 * visibles même quand la page est défilée, au lieu d'un bandeau perdu en haut. Un succès disparaît seul au
 * bout de 5 s (et se ferme à la main) ; une erreur reste jusqu'à ce qu'on la ferme. Annoncées aux lecteurs
 * d'écran (`status` / `alert`). Les pages gardent leurs états `notice` / `error` tels quels.
 */
export function AdminFeedback({
  notice,
  error,
  onDismissNotice,
  onDismissError,
}: {
  notice: string | null;
  error: string | null;
  onDismissNotice: () => void;
  onDismissError: () => void;
}) {
  // Le rappel est lu via une référence : les pages passent une flèche neuve à chaque rendu, ce qui relancerait le
  // décompte de 5 s à la moindre frappe dans un champ de la page.
  const dismissNotice = useRef(onDismissNotice);
  useEffect(() => {
    dismissNotice.current = onDismissNotice;
  });
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => dismissNotice.current(), NOTICE_MS);
    return () => clearTimeout(timeout);
  }, [notice]);

  if (!notice && !error) return null;
  const base =
    "app-rise pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm text-ink shadow-raised";
  const close = "-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600";

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2">
      {error ? (
        <div role="alert" className={`${base} border-status-danger/40`}>
          <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-status-danger" />
          <p className="min-w-0 flex-1">{error}</p>
          <button type="button" aria-label="Fermer le message d'erreur" onClick={onDismissError} className={close}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className={`${base} border-forest-600/40`}>
          <CircleCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-forest-600" />
          <p className="min-w-0 flex-1">{notice}</p>
          <button type="button" aria-label="Fermer la confirmation" onClick={onDismissNotice} className={close}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
