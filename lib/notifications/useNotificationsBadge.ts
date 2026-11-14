"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getPendingInvitationsCount } from "@/lib/api/calendar";
import { listNotifications } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthContext";
import { subscribeNotificationsBadgeStale } from "@/lib/notifications/badgeSignal";

/**
 * Point 1 — distinct de `readAt` (qui contrôle le contraste lu/non-lu DANS la
 * liste, §5.10, jamais touché ici). Ceci ne fait qu'"acquitter" le badge :
 * visiter /notifications avance ce repère à "maintenant", donc toute notification
 * déjà non lue à cet instant cesse de déclencher le badge — mais une nouvelle
 * notification créée APRÈS cette visite le rallume bien. localStorage (par
 * navigateur/appareil, pas de synchronisation nécessaire) plutôt qu'un champ
 * serveur : évite d'inventer un endpoint pour un simple repère d'affichage.
 */
const ACK_STORAGE_PREFIX = "clientia:notifications-acknowledged-at:";

/**
 * Namespacé par utilisateur — sans ça, deux comptes de démo ouverts tour à tour
 * dans le même navigateur partageraient le même repère localStorage : acquitter en
 * tant que Camille masquerait à tort le badge de Robin au prochain login.
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

/**
 * Pastille "non lu" des notifications — calculée UNE fois (AppChrome) et partagée entre l'entrée
 * "Notifications" du rail et la cloche de la barre du haut.
 *
 * Deux signaux distincts combinés en OR, tranché explicitement avec l'utilisateur : les notifications
 * informatives suivent le repère de visite (`acknowledgeNotifications`) — visiter /notifications suffit à
 * les "acquitter". Mais une invitation `PENDING` (EVENT_INVITATION) est actionnable : visiter la liste ne
 * la traite pas, seule une réponse (accepter/décliner) le fait — donc son décompte ignore complètement le
 * repère de visite et l'ancienneté (`GET /calendar-events/pending-invitations-count`, sans filtre de date).
 */
export function useNotificationsBadge(): boolean {
  const pathname = usePathname();
  const { user, hasPermission, authedFetch } = useAuth();
  const [showBadge, setShowBadge] = useState(false);

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
        const hasUnseenInformative =
          Boolean(notifRes) && notifRes!.unreadCount > 0 && (!latestUnreadAt || latestUnreadAt > ackAt);
        const hasPendingInvitation = Boolean(pendingRes) && pendingRes!.count > 0;
        setShowBadge(hasUnseenInformative || hasPendingInvitation);
      })
      .catch(() => {
        // Non bloquant : au pire le badge reste dans son dernier état connu.
      });
  }, [pathname, authedFetch, hasPermission, user]);

  // Revérifié à chaque navigation (le composant qui appelle ce hook est monté en permanence)...
  useEffect(() => {
    refreshBadge();
  }, [refreshBadge]);

  /**
   * ...et sur ce signal explicite — sans lui, répondre à sa propre invitation depuis EventPanel (imbriqué
   * dans /calendar-pro, qui ne change pas de route en répondant) ne rafraîchirait le badge qu'à la prochaine
   * navigation. Toujours pas de polling : uniquement déclenché par une action réelle qui affecte le compteur.
   */
  useEffect(() => subscribeNotificationsBadgeStale(refreshBadge), [refreshBadge]);

  return showBadge;
}
