"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { getPendingInvitationsCount } from "@/lib/api/calendar";
import { listNotifications } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthContext";
import { isNavItemVisible, NAV_ITEMS } from "@/lib/nav/navItems";
import { subscribeNotificationsBadgeStale } from "@/lib/notifications/badgeSignal";

const STORAGE_KEY = "clientia:rail-collapsed";
/**
 * Point 1 — distinct de `readAt` (qui contrôle le contraste lu/non-lu DANS la
 * liste, §5.10, jamais touché ici). Ceci ne fait qu'"acquitter" le badge du rail :
 * visiter /notifications avance ce repère à "maintenant", donc toute notification
 * déjà non lue à cet instant cesse de déclencher le badge — mais une nouvelle
 * notification créée APRÈS cette visite le rallume bien. localStorage (par
 * navigateur/appareil, pas de synchronisation nécessaire) plutôt qu'un champ
 * serveur : évite d'inventer un endpoint pour un simple repère d'affichage.
 */
const ACK_STORAGE_PREFIX = "clientia:notifications-acknowledged-at:";

/**
 * Namespacé par utilisateur — sans ça, deux comptes de démo ouverts tour à tour
 * dans le même navigateur (exactement le scénario de test de cette session)
 * partageraient le même repère localStorage : acquitter en tant que Camille
 * masquerait à tort le badge de Robin au prochain login. Repéré en préparant la
 * preuve en direct de ce point, pas en le devinant à l'avance.
 */
export function getNotificationsAcknowledgedAt(userId: string): string {
  try {
    return localStorage.getItem(ACK_STORAGE_PREFIX + userId) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

export function acknowledgeNotifications(userId: string) {
  try {
    localStorage.setItem(ACK_STORAGE_PREFIX + userId, new Date().toISOString());
  } catch {
    // stockage indisponible — le badge peut rester visible, pas bloquant
  }
}

export function SideRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hasPermission, authedFetch } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotificationsBadge, setShowNotificationsBadge] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // stockage indisponible — repli silencieux sur l'état déplié par défaut
    }
  }, []);

  /**
   * Deux signaux distincts combinés en OR, tranché explicitement avec
   * l'utilisateur : les notifications informatives suivent le repère de visite
   * (`acknowledgeNotifications`, ci-dessus) — visiter /notifications suffit à les
   * "acquitter", pas la peine d'attendre un clic individuel. Mais une invitation
   * `PENDING` (EVENT_INVITATION) est actionnable : visiter la liste ne la traite
   * pas, seule une réponse (accepter/décliner) le fait — donc son décompte ignore
   * complètement le repère de visite et l'ancienneté (`GET
   * /calendar-events/pending-invitations-count`, sans filtre de date).
   */
  const refreshBadge = useCallback(() => {
    if (!user) return;
    const canSeeNotifications = hasPermission("notifications.view");
    const canSeeCalendar = hasPermission("calendar.view");
    if (!canSeeNotifications && !canSeeCalendar) return;

    if (pathname === "/notifications" && canSeeNotifications) {
      acknowledgeNotifications(user.id);
    }

    Promise.all([
      canSeeNotifications
        ? authedFetch((token) => listNotifications({ unreadOnly: true, page: 1, pageSize: 1 }, token))
        : Promise.resolve(null),
      canSeeCalendar ? authedFetch((token) => getPendingInvitationsCount(token)) : Promise.resolve(null),
    ])
      .then(([notifRes, pendingRes]) => {
        const latestUnreadAt = notifRes?.items[0]?.createdAt;
        const ackAt = getNotificationsAcknowledgedAt(user.id);
        const hasUnseenInformative = Boolean(notifRes) && notifRes!.unreadCount > 0 && (!latestUnreadAt || latestUnreadAt > ackAt);
        const hasPendingInvitation = Boolean(pendingRes) && pendingRes!.count > 0;
        setShowNotificationsBadge(hasUnseenInformative || hasPendingInvitation);
      })
      .catch(() => {
        // Non bloquant : au pire le badge reste dans son dernier état connu.
      });
  }, [pathname, authedFetch, hasPermission, user]);

  // Revérifié à chaque navigation (le rail est monté en permanence)...
  useEffect(() => {
    refreshBadge();
  }, [refreshBadge]);

  /**
   * ...et sur ce signal explicite — sans lui, répondre à sa propre invitation
   * depuis EventPanel (imbriqué dans /calendar-pro, qui ne change pas de route en
   * répondant) ne rafraîchirait le badge qu'à la prochaine navigation. Gap trouvé
   * en testant en direct ce point, pas anticipé à l'avance. Toujours pas de
   * polling : uniquement déclenché par une action réelle qui affecte le compteur.
   */
  useEffect(() => subscribeNotificationsBadgeStale(refreshBadge), [refreshBadge]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // idem
      }
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-surface transition-[width]",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className={cn("flex items-center border-b border-border px-3 py-4", collapsed ? "justify-center" : "justify-between")}>
        {collapsed ? null : <span className="font-display text-lg font-bold text-ink">CLIENTIA</span>}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-md p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink"
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.filter((item) => isNavItemVisible(item.permission, hasPermission)).map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge = item.href === "/notifications" && showNotificationsBadge;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-forest-50 text-forest-600" : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? (showBadge ? `${item.label} (non lues)` : item.label) : undefined}
            >
              <span className="relative shrink-0">
                <Icon size={18} />
                {showBadge ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-surface bg-forest-600"
                    aria-hidden
                  />
                ) : null}
              </span>
              {collapsed ? null : (
                <span className="flex items-center gap-1.5">
                  {item.label}
                  {showBadge ? <span className="sr-only">— notifications non lues</span> : null}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        {collapsed ? null : (
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">
              {user?.firstName ?? user?.email} {user?.lastName ?? ""}
            </p>
            <p className="truncate text-xs text-ink-muted">{user?.roleName}</p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-subtle hover:text-status-danger",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? "Se déconnecter" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {collapsed ? null : "Se déconnecter"}
        </button>
      </div>
    </aside>
  );
}
