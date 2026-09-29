/** Bornes de la journée en cours, en heure locale du navigateur (même convention que le reste de l'app), sérialisées pour changedFrom/changedTo. */
export function todayRange(now: Date = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { changedFrom: start.toISOString(), changedTo: end.toISOString() };
}
