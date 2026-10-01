import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEventDTO } from "@/lib/api/calendar";
import { listUsers } from "@/lib/api/users";
import { PASTEL_PALETTE } from "@/lib/calendar/personColors";
import CalendarProPage from "./page";

/**
 * Correctif distinct de la garde §6.25 (livré avec le lot D) : EventPanel monté
 * avec `key`. Cas réel : clic sur une notification de rappel (`?eventId=`) pendant
 * l'édition d'un autre événement. Simulé ici par la grille, qui passe par le même
 * `setPanel({ mode: "edit", event })`.
 */
const eventA = { id: "eA", title: "Point A", type: "MEETING", organizerId: "u1", categoryId: null,
  startAt: "2026-09-30T08:00:00.000Z", endAt: "2026-09-30T09:00:00.000Z" } as unknown as CalendarEventDTO;
const eventB = { ...eventA, id: "eB", title: "Point B" } as CalendarEventDTO;

vi.mock("@/components/calendar/CalendarGrid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/calendar/CalendarGrid")>()),
  CalendarGrid: ({ onEventClick }: { onEventClick: (e: CalendarEventDTO) => void }) => (
    <>
      <button onClick={() => onEventClick(eventA)}>ouvrir A</button>
      <button onClick={() => onEventClick(eventB)}>ouvrir B</button>
    </>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api/calendar", () => ({
  listCalendars: vi.fn().mockResolvedValue([{ id: "cal1", userId: "u1" }]),
  createCalendar: vi.fn(),
  listEvents: vi.fn().mockResolvedValue([]),
  listEventCategories: vi.fn().mockResolvedValue([]),
  getEvent: vi.fn().mockResolvedValue({ attendees: [], conflicts: [] }),
  listReminders: vi.fn().mockResolvedValue([]),
  updateEvent: vi.fn(),
}));
vi.mock("@/lib/api/clients", () => ({ getClient: vi.fn() }));
vi.mock("@/lib/api/calls", () => ({ getCall: vi.fn(), listCalls: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock("@/lib/api/users", () => ({ listUsers: vi.fn().mockResolvedValue([]) }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ authedFetch, user: { id: "u1" }, hasPermission: () => true }),
}));

describe("calendar-pro — EventPanel remonté à chaque événement (key)", () => {
  it("ouvrir B pendant l'édition de A affiche B, pas la saisie de A", async () => {
    render(<CalendarProPage />);
    fireEvent.click(await screen.findByRole("button", { name: "ouvrir A" }));
    fireEvent.change(await screen.findByLabelText("Titre"), { target: { value: "Brouillon de A" } });

    fireEvent.click(screen.getByRole("button", { name: "ouvrir B" }));
    expect(screen.getByLabelText("Titre")).toHaveValue("Point B");
  });
});

describe("calendar-pro — vue partagée : légende", () => {
  it("liste les agents RDV actifs avec leur couleur stable (rang d'ancienneté), pas les autres rôles", async () => {
    const u = (id: string, firstName: string, role: string, createdAt: string, isActive = true) => ({
      id, firstName, lastName: null, email: `${id}@x`, isActive, createdAt, role: { id: role, name: role },
    });
    vi.mocked(listUsers).mockResolvedValueOnce([
      u("sam", "Sam", "Agent RDV", "2026-03-01T00:00:00Z"),
      u("u1", "Alix", "Administrateur", "2026-01-01T00:00:00Z"),
      u("robin", "Robin", "Agent RDV", "2026-02-01T00:00:00Z"),
      u("old", "Olga", "Agent RDV", "2026-01-15T00:00:00Z", false),
      u("cam", "Camille", "Agent calliste", "2026-04-01T00:00:00Z"),
    ]);
    render(<CalendarProPage />);
    const legend = await screen.findByRole("list", { name: "Légende des agendas" });
    const items = within(legend).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Sam", "Robin"]);
    // Rangs : Alix 0, Olga 1 (inactive, garde son rang), Robin 2, Sam 3.
    const swatch = (li: HTMLElement) => (li.querySelector("span") as HTMLElement).style.backgroundColor;
    const hexToRgb = (h: string) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
    expect(swatch(items[0]!)).toBe(hexToRgb(PASTEL_PALETTE[3]!));
    expect(swatch(items[1]!)).toBe(hexToRgb(PASTEL_PALETTE[2]!));
  });
});
