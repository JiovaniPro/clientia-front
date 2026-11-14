const RELATIVE = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

/** "il y a 6 heures", "hier", "dans 2 jours" ; au-delà de 30 jours, la date courte. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000);
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return RELATIVE.format(days, "day");
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "short" });
}
