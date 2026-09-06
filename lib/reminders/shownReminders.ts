const STORAGE_PREFIX = "clientia:reminder-popups-shown:";
const MAX_TRACKED = 100;

/**
 * Namespacé par utilisateur — même bug de fond que celui corrigé pour le repère
 * d'acquittement du badge (voir SideRail.tsx::ACK_STORAGE_PREFIX) : plusieurs
 * comptes de démo dans le même navigateur ne doivent pas se "voler" leurs popups
 * déjà affichés. Persisté (pas juste un état React) pour survivre à un rechargement
 * de page sans reproposer un popup déjà vu.
 */
function key(userId: string) {
  return STORAGE_PREFIX + userId;
}

export function getShownReminderIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markReminderShown(userId: string, notificationId: string) {
  try {
    const ids = getShownReminderIds(userId);
    ids.add(notificationId);
    // Borné : une session longue ne doit pas accumuler indéfiniment — on ne garde
    // que les plus récents, un popup très ancien "oublié" n'a plus d'intérêt.
    const trimmed = Array.from(ids).slice(-MAX_TRACKED);
    localStorage.setItem(key(userId), JSON.stringify(trimmed));
  } catch {
    // stockage indisponible — au pire un popup peut réapparaître une fois de plus.
  }
}
