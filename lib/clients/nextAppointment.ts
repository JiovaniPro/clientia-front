/**
 * Lecture « humaine » du prochain rendez-vous d'un dossier : « Aujourd'hui », « Demain », « Jeudi », « 19 nov. ».
 * `tone` règle l'urgence visuelle (aujourd'hui > cette semaine > plus tard > aucun) — jamais la couleur seule :
 * le libellé porte l'information.
 */
export type NextAppointmentTone = "today" | "soon" | "later" | "none";

export interface NextAppointmentView {
  /** « Aujourd'hui », « Demain », « Jeudi », « 19 nov. » — « Aucun RDV planifié » s'il n'y en a pas. */
  label: string;
  /** « 14:30 », ou null sans rendez-vous. */
  time: string | null;
  tone: NextAppointmentTone;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function describeNextAppointment(iso: string | null, now: Date = new Date()): NextAppointmentView {
  if (!iso) return { label: "Aucun RDV planifié", time: null, tone: "none" };
  const date = new Date(iso);
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);

  if (days === 0) return { label: "Aujourd'hui", time, tone: "today" };
  if (days === 1) return { label: "Demain", time, tone: "soon" };
  if (days > 1 && days < 7) {
    return { label: capitalize(date.toLocaleDateString("fr-FR", { weekday: "long" })), time, tone: "soon" };
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return {
    label: date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }),
    time,
    tone: "later",
  };
}
