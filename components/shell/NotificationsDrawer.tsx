"use client";

import { ArrowRight, BellOff, CheckCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { NotificationDTO } from "@/lib/api/notifications";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthContext";
import { notifyNotificationsBadgeStale } from "@/lib/notifications/badgeSignal";
import { getEventIdFromMeta } from "@/lib/notifications/meta";
import { acknowledgeNotifications } from "@/lib/notifications/useNotificationsBadge";

const LATEST = 5;
const RELATIVE = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

/** « il y a 5 minutes », « hier » ; au-delà d'une semaine, la date courte. */
function formatAgo(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return RELATIVE.format(days, "day");
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "short" });
}

/**
 * Cloche de la barre du haut : les 5 dernières notifications dans un tiroir qui glisse depuis la
 * droite, sans quitter l'écran
 * en cours. Les non lues sont teintées, marquées d'un point et d'une étiquette « Non lu ». Un clic
 * marque la notification comme lue et, si elle porte un événement, y mène. Ouvrir le tiroir vaut
 * visite : la pastille de la cloche est acquittée, comme en ouvrant la page /notifications
 * (qui reste accessible par « Voir toutes les notifications »). Fermeture : croix, Échap, clic sur le fond.
 */
export function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const { user, authedFetch } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(
    null,
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Rechargée à l'ouverture, puis après chaque marquage (reload).
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    authedFetch((token) =>
      listNotifications({ page: 1, pageSize: LATEST }, token),
    )
      .then((response) => {
        if (cancelled) return;
        setNotifications(response.items);
        setUnreadCount(response.unreadCount);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les notifications.");
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, reloadKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!user) return;
    acknowledgeNotifications(user.id);
    notifyNotificationsBadgeStale();
  }, [user]);

  async function open(notification: NotificationDTO) {
    if (!notification.readAt) {
      try {
        await authedFetch((token) =>
          markNotificationAsRead(notification.id, token),
        );
        notifyNotificationsBadgeStale();
        load();
      } catch {
        setError("Impossible de marquer cette notification comme lue.");
        return;
      }
    }
    const eventId = getEventIdFromMeta(notification.meta);
    if (eventId) {
      onClose();
      router.push(`/calendar-pro?eventId=${eventId}`);
    }
  }

  async function markAll() {
    try {
      await authedFetch((token) => markAllNotificationsAsRead(token));
      notifyNotificationsBadgeStale();
      load();
    } catch {
      setError("Impossible de marquer les notifications comme lues.");
    }
  }

  return (
    <div
      className="app-fade fixed inset-0 z-50 flex justify-end bg-ink/40"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-drawer-title"
        onClick={(e) => e.stopPropagation()}
        className="app-drawer flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-raised"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <h2
            id="notifications-drawer-title"
            className="font-display text-lg font-semibold text-ink"
          >
            Notifications
          </h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Fermer"
            className="rounded-md p-1 text-ink-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p aria-live="polite" className="text-sm text-ink-muted">
            {notifications === null
              ? "Chargement…"
              : unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                : "Tout est lu"}
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={markAll}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={16} aria-hidden />
            Tout marquer comme lu
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <p role="alert" className="text-sm text-status-danger">
                {error}
              </p>
              <Button size="sm" variant="secondary" onClick={load}>
                Réessayer
              </Button>
            </div>
          ) : null}

          {notifications === null ? (
            error ? null : (
              <ul aria-hidden className="divide-y divide-border">
                {Array.from({ length: LATEST }, (_, i) => (
                  <li key={i} className="space-y-2 px-5 py-3.5">
                    <span className="block h-3.5 w-2/3 animate-pulse rounded-sm bg-surface-subtle" />
                    <span className="block h-3 w-1/2 animate-pulse rounded-sm bg-surface-subtle" />
                  </li>
                ))}
              </ul>
            )
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <BellOff size={22} aria-hidden className="text-ink-faint" />
              <p className="text-sm font-medium text-ink">
                Aucune notification pour l&apos;instant.
              </p>
              <p className="text-sm text-ink-muted">
                Les invitations et les changements sur vos rendez-vous
                apparaîtront ici.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const unread = !n.readAt;
                const eventId = getEventIdFromMeta(n.meta);
                return (
                  <li
                    key={n.id}
                    className={cn("app-rise", unread && "bg-forest-50")}
                  >
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          unread ? "bg-forest-600" : "border border-border",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span
                            className={cn(
                              "text-sm",
                              unread
                                ? "font-semibold text-ink"
                                : "text-ink-muted",
                            )}
                          >
                            {n.title}
                          </span>
                          {unread ? (
                            <span className="shrink-0 rounded-sm bg-forest-600 px-1.5 py-0.5 text-[11px] font-medium text-white dark:text-cream">
                              Non lu
                            </span>
                          ) : null}
                        </span>
                        {n.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">
                            {n.body}
                          </span>
                        ) : null}
                        <span className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
                          <span className="font-mono">
                            {formatAgo(n.createdAt)}
                          </span>
                          {eventId ? (
                            <span className="font-medium text-forest-600">
                              · voir l&apos;événement
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-4">
          <Link
            href="/notifications"
            onClick={onClose}
            className="group inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-forest-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            Voir toutes les notifications
            <ArrowRight
              size={14}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </aside>
    </div>
  );
}
