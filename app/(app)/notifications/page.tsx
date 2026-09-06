"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { NotificationDTO } from "@/lib/api/notifications";
import { listNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 25;

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * §P1.3 — le champ `meta` existait déjà (voir modules/calendar/service.ts, posé
 * sur APPOINTMENT_ASSIGNED/CONFIRMED/REFUSED/UPDATED et désormais EVENT_INVITATION)
 * mais aucune redirection au clic n'était câblée côté frontend : cette page se
 * contentait de marquer comme lu. Gap corrigé ici, pas juste pour le nouveau type —
 * tout `meta.eventId` présent redirige, quel que soit le type de notification.
 */
function getEventIdFromMeta(meta: unknown): string | undefined {
  if (meta && typeof meta === "object" && "eventId" in meta) {
    const value = (meta as { eventId?: unknown }).eventId;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/**
 * §5.10 — Toujours scopé au destinataire côté backend (voir modules/notifications/
 * service.ts). Une notification naît d'un événement métier réel (RDV assigné,
 * confirmé, refusé...) — voir lib/notifications.ts et modules/calendar/service.ts,
 * qui est le seul module à en émettre aujourd'hui (le calendrier n'a pas encore
 * d'écran frontend, arrive après ce lot) : la liste peut donc rester vide tant
 * qu'aucun rendez-vous n'a été créé/assigné via l'API.
 */
export default function NotificationsPage() {
  const { authedFetch } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authedFetch((token) =>
        listNotifications({ unreadOnly: unreadOnly || undefined, page, pageSize: PAGE_SIZE }, token),
      );
      setNotifications(response.items);
      setUnreadCount(response.unreadCount);
    } catch {
      setError("Impossible de charger les notifications.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, unreadOnly, page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function handleNotificationClick(notification: NotificationDTO) {
    if (!notification.readAt) {
      try {
        await authedFetch((token) => markNotificationAsRead(notification.id, token));
        fetchNotifications();
      } catch {
        setError("Impossible de marquer cette notification comme lue.");
      }
    }
    const eventId = getEventIdFromMeta(notification.meta);
    if (eventId) router.push(`/calendar-pro?eventId=${eventId}`);
  }

  async function handleMarkAllAsRead() {
    try {
      await authedFetch((token) => markAllNotificationsAsRead(token));
      fetchNotifications();
    } catch {
      setError("Impossible de marquer les notifications comme lues.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.10</p>
          <h1 className="font-display text-2xl font-bold text-ink">
            Notifications {unreadCount > 0 ? <span className="text-forest-600">({unreadCount})</span> : null}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setPage(1);
                setUnreadOnly(e.target.checked);
              }}
            />
            Non lues uniquement
          </label>
          <Button size="sm" variant="secondary" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
            Tout marquer comme lu
          </Button>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <p className="p-6 text-sm text-status-danger">{error}</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Chargement…</p>
        ) : notifications.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Aucune notification.</p>
        ) : (
          <ul>
            {notifications.map((n) => {
              const eventId = getEventIdFromMeta(n.meta);
              return (
              <li
                key={n.id}
                className={cn(
                  "border-b border-border last:border-0",
                  // §5.10 — l'état non-lu doit être immédiatement scannable dans une
                  // longue liste : le point seul (déjà là) était trop discret. Fond
                  // teinté + liseré gauche, même langage que la mise en avant du lien
                  // actif du rail (bg-forest-50) — pas une couleur inventée pour
                  // l'occasion.
                  !n.readAt && "border-l-4 border-l-forest-600 bg-forest-50",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-subtle/60"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: n.readAt ? "transparent" : "var(--color-forest-600)" }}
                    aria-hidden
                  />
                  <div className="flex-1">
                    <p className={n.readAt ? "text-sm text-ink-muted" : "text-sm font-medium text-ink"}>
                      {n.title}
                      {eventId ? <span className="ml-1.5 text-xs font-normal text-forest-600">→ voir l&apos;événement</span> : null}
                    </p>
                    {n.body ? <p className="text-xs text-ink-muted">{n.body}</p> : null}
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-faint">{formatCreatedAt(n.createdAt)}</span>
                </button>
              </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-ink-muted">
          <span>page {page}</span>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={notifications.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
