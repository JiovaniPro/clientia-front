/**
 * `meta.eventId` d'une notification (posé par modules/calendar/service.ts côté backend) : s'il est
 * présent, un clic sur la notification mène à l'événement, quel que soit son type.
 */
export function getEventIdFromMeta(meta: unknown): string | undefined {
  if (meta && typeof meta === "object" && "eventId" in meta) {
    const value = (meta as { eventId?: unknown }).eventId;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}
