"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listNotifications, type NotificationDTO } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthContext";
import { playReminderSound } from "@/lib/reminders/reminderSound";
import { getShownReminderIds, markReminderShown } from "@/lib/reminders/shownReminders";

const POLL_INTERVAL_MS = 25_000;

function getEventIdFromMeta(meta: unknown): string | undefined {
  if (meta && typeof meta === "object" && "eventId" in meta) {
    const value = (meta as { eventId?: unknown }).eventId;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

function getReminderMethodFromMeta(meta: unknown): "POPUP" | "SOUND" | undefined {
  if (meta && typeof meta === "object" && "method" in meta) {
    const value = (meta as { method?: unknown }).method;
    return value === "POPUP" || value === "SOUND" ? value : undefined;
  }
  return undefined;
}

/**
 * Sous-lot C3 — méthodes POPUP/SOUND : aucune infra de push (WebSocket/SSE)
 * n'existe dans ce projet, donc affichage par sondage léger plutôt qu'en temps
 * réel exact — limite déjà signalée à l'utilisateur (voir EventPanel). Monté une
 * fois dans le layout applicatif persistant (comme SideRail) pour rester actif
 * quelle que soit la page visitée, pas seulement /calendar-pro.
 *
 * Ne réutilise PAS le badge du rail (SideRail) : deux préoccupations distinctes
 * — le badge dit "il y a du nouveau", ce composant fait réellement apparaître le
 * popup au bon moment, avec dédup persistante par utilisateur pour ne jamais le
 * réafficher après un simple rechargement de page.
 */
export function ReminderPopupListener() {
  const { user, authedFetch, hasPermission } = useAuth();
  const router = useRouter();
  const [toasts, setToasts] = useState<NotificationDTO[]>([]);
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (user) shownRef.current = getShownReminderIds(user.id);
  }, [user]);

  const poll = useCallback(() => {
    if (!user || !hasPermission("notifications.view")) return;
    authedFetch((token) => listNotifications({ unreadOnly: true, page: 1, pageSize: 25 }, token))
      .then((res) => {
        const fresh = res.items.filter((n) => n.type === "EVENT_REMINDER" && !shownRef.current.has(n.id));
        if (fresh.length === 0) return;
        for (const notification of fresh) {
          shownRef.current.add(notification.id);
          markReminderShown(user.id, notification.id);
          if (getReminderMethodFromMeta(notification.meta) === "SOUND") playReminderSound();
        }
        /**
         * Dédup contre l'état réel au moment de l'application (pas juste contre
         * `shownRef` au moment du filtre ci-dessus) — trouvé en direct : deux
         * `poll()` qui se chevauchent (StrictMode en dev, ou un sondage lent qui
         * n'a pas fini avant le suivant) lisent tous les deux `shownRef` AVANT
         * qu'aucun des deux ne l'ait mis à jour, donc les deux calculent le même
         * `fresh` et poussent le même rappel deux fois. Le filtre fonctionnel
         * ci-dessous s'applique toujours à l'état React à jour, jamais à une
         * fermeture obsolète — le second appel voit forcément le premier déjà
         * appliqué.
         */
        setToasts((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const toAdd = fresh.filter((n) => !existingIds.has(n.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      })
      .catch(() => {
        // Non bloquant — au pire le prochain sondage rattrape.
      });
  }, [user, hasPermission, authedFetch]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleClick(notification: NotificationDTO) {
    dismiss(notification.id);
    const eventId = getEventIdFromMeta(notification.meta);
    if (eventId) router.push(`/calendar-pro?eventId=${eventId}`);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-2 rounded-md border border-forest-600/30 bg-surface p-3 shadow-raised"
        >
          <button type="button" onClick={() => handleClick(t)} className="flex-1 text-left">
            <p className="text-sm font-medium text-ink">{t.title}</p>
            {t.body ? <p className="text-xs text-ink-muted">{t.body}</p> : null}
          </button>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-surface-subtle hover:text-ink"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
