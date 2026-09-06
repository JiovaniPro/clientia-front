import type { CalendarEventDTO } from "@/lib/api/calendar";

export interface PositionedEvent {
  event: CalendarEventDTO;
  /** Index de colonne (0 = plus à gauche) à l'intérieur de son groupe de chevauchement. */
  col: number;
  /** Nombre de colonnes du groupe — largeur de l'événement = 100% / totalCols. */
  totalCols: number;
}

/**
 * Répartition en colonnes façon Outlook/Google Calendar (sous-lot B, §5.14).
 * Algorithme en deux passes sur les événements triés par heure de début :
 *  1. Regroupe en "clusters" — un cluster est un ensemble d'événements qui se
 *     chevauchent transitivement (A chevauche B, B chevauche C => A, B, C dans le
 *     même cluster même si A et C ne se touchent pas directement). Un nouveau
 *     cluster démarre dès qu'un événement commence après la fin de TOUS les
 *     événements vus jusqu'ici dans le cluster courant.
 *  2. À l'intérieur d'un cluster, chaque événement prend la première colonne
 *     libre (dont le dernier événement placé se termine avant/à son heure de
 *     début) ; sinon une nouvelle colonne est créée. `totalCols` du cluster =
 *     nombre de colonnes utilisées au total (le pic de chevauchement simultané),
 *     partagé par tous les événements du cluster même ceux qui ne chevauchent pas
 *     directement le pic — c'est le comportement Outlook standard.
 */
export function layoutDayEvents(events: CalendarEventDTO[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => {
    const startDiff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    if (startDiff !== 0) return startDiff;
    return new Date(a.endAt).getTime() - new Date(b.endAt).getTime();
  });

  const result: PositionedEvent[] = [];
  let clusterEvents: { event: CalendarEventDTO; col: number }[] = [];
  let columnEndTimes: number[] = [];
  let clusterMaxEnd = -Infinity;

  function flushCluster() {
    if (clusterEvents.length === 0) return;
    const totalCols = columnEndTimes.length;
    for (const p of clusterEvents) {
      result.push({ event: p.event, col: p.col, totalCols });
    }
    clusterEvents = [];
    columnEndTimes = [];
    clusterMaxEnd = -Infinity;
  }

  for (const event of sorted) {
    const start = new Date(event.startAt).getTime();
    const end = new Date(event.endAt).getTime();

    if (clusterEvents.length > 0 && start >= clusterMaxEnd) {
      flushCluster();
    }

    let col = columnEndTimes.findIndex((endTime) => endTime <= start);
    if (col === -1) {
      col = columnEndTimes.length;
      columnEndTimes.push(end);
    } else {
      columnEndTimes[col] = end;
    }

    clusterEvents.push({ event, col });
    clusterMaxEnd = Math.max(clusterMaxEnd, end);
  }
  flushCluster();

  return result;
}
