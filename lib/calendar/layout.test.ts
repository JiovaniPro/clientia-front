import { describe, expect, it } from "vitest";
import { layoutDayEvents } from "./layout";
import type { CalendarEventDTO } from "@/lib/api/calendar";

function makeEvent(id: string, startHM: string, endHM: string): CalendarEventDTO {
  return {
    id,
    organizationId: "org",
    calendarId: "cal",
    title: id,
    description: null,
    location: null,
    startAt: `2026-09-01T${startHM}:00.000Z`,
    endAt: `2026-09-01T${endHM}:00.000Z`,
    timezone: "Europe/Paris",
    isAllDay: false,
    type: "MEETING",
    availability: "BUSY",
    priority: "NORMAL",
    recurrenceRule: null,
    recurrenceId: null,
    isRecurring: false,
    exceptionDates: null,
    isPrivate: false,
    categoryId: null,
    tags: [],
    organizerId: "user",
    callId: null,
    clientId: null,
    agentRdvId: null,
    status: null,
    callNotesSnapshot: null,
    agentComment: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("layoutDayEvents — répartition en colonnes façon Outlook", () => {
  it("un seul événement isolé occupe toute la largeur", () => {
    const result = layoutDayEvents([makeEvent("A", "09:00", "10:00")]);
    expect(result).toEqual([{ event: expect.objectContaining({ id: "A" }), col: 0, totalCols: 1 }]);
  });

  it("deux événements qui se touchent exactement (fin = début) ne se chevauchent pas", () => {
    const result = layoutDayEvents([makeEvent("A", "09:00", "10:00"), makeEvent("B", "10:00", "11:00")]);
    expect(result.find((r) => r.event.id === "A")).toMatchObject({ col: 0, totalCols: 1 });
    expect(result.find((r) => r.event.id === "B")).toMatchObject({ col: 0, totalCols: 1 });
  });

  it("deux événements qui se chevauchent partagent 2 colonnes", () => {
    const result = layoutDayEvents([makeEvent("A", "09:00", "10:00"), makeEvent("B", "09:30", "10:30")]);
    const a = result.find((r) => r.event.id === "A")!;
    const b = result.find((r) => r.event.id === "B")!;
    expect(a.totalCols).toBe(2);
    expect(b.totalCols).toBe(2);
    expect(a.col).not.toBe(b.col);
  });

  it("une colonne libérée est réutilisée par un événement qui démarre après", () => {
    // A(9-9:30) se termine avant que C(9:45-10:30) démarre => C peut réutiliser la colonne de A.
    // B(9-10:30) chevauche tout le monde => reste sur sa propre colonne.
    const result = layoutDayEvents([
      makeEvent("A", "09:00", "09:30"),
      makeEvent("B", "09:00", "10:30"),
      makeEvent("C", "09:45", "10:30"),
    ]);
    const a = result.find((r) => r.event.id === "A")!;
    const b = result.find((r) => r.event.id === "B")!;
    const c = result.find((r) => r.event.id === "C")!;
    expect(a.totalCols).toBe(2);
    expect(b.totalCols).toBe(2);
    expect(c.totalCols).toBe(2);
    expect(b.col).not.toBe(a.col);
    expect(c.col).toBe(a.col); // C réutilise la colonne libérée par A
  });

  it("chaîne transitive A-B-C (A et C ne se touchent pas directement) : même cluster, pic à 2 colonnes", () => {
    const result = layoutDayEvents([
      makeEvent("A", "09:00", "10:00"),
      makeEvent("B", "09:30", "11:00"),
      makeEvent("C", "10:30", "11:30"),
    ]);
    const a = result.find((r) => r.event.id === "A")!;
    const b = result.find((r) => r.event.id === "B")!;
    const c = result.find((r) => r.event.id === "C")!;
    expect(a.totalCols).toBe(2);
    expect(b.totalCols).toBe(2);
    expect(c.totalCols).toBe(2);
    expect(a.col).toBe(c.col); // C réutilise la colonne de A, libérée à 10:00
    expect(b.col).not.toBe(a.col);
  });

  it("deux clusters séparés dans la même journée ont chacun leur propre largeur", () => {
    const result = layoutDayEvents([
      makeEvent("A", "09:00", "10:00"),
      makeEvent("B", "09:30", "10:30"), // cluster 1 avec A : 2 colonnes
      makeEvent("C", "14:00", "15:00"), // cluster 2, isolé : 1 colonne
    ]);
    expect(result.find((r) => r.event.id === "A")!.totalCols).toBe(2);
    expect(result.find((r) => r.event.id === "B")!.totalCols).toBe(2);
    expect(result.find((r) => r.event.id === "C")!.totalCols).toBe(1);
  });

  it("trois événements simultanés => 3 colonnes", () => {
    const result = layoutDayEvents([
      makeEvent("A", "09:00", "10:00"),
      makeEvent("B", "09:00", "10:00"),
      makeEvent("C", "09:00", "10:00"),
    ]);
    const cols = result.map((r) => r.col).sort();
    expect(cols).toEqual([0, 1, 2]);
    expect(result.every((r) => r.totalCols === 3)).toBe(true);
  });
});
