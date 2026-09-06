/**
 * Petit bus d'événement local (pas de state partagé/contexte global à inventer
 * pour un seul signal) — comble un vrai gap trouvé en testant en direct : répondre
 * à sa propre invitation (EventPanel, imbriqué dans /calendar-pro) doit faire
 * disparaître le badge du rail (SideRail, dans le layout partagé), mais les deux
 * ne partagent aucun état et le badge ne se revérifie que sur changement de
 * `pathname` — jamais déclenché par une action qui reste sur la même route.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyNotificationsBadgeStale() {
  listeners.forEach((listener) => listener());
}

export function subscribeNotificationsBadgeStale(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
