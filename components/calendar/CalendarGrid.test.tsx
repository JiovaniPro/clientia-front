import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventDTO } from "@/lib/api/calendar";
import { CalendarGrid } from "./CalendarGrid";

// 1 h = 56 px, grille 07:00–21:00 (784 px). jsdom : getBoundingClientRect() = 0, donc clientY = décalage.
const HOUR = 56;
const NOW = new Date(2026, 9, 1, 10, 0); // aujourd'hui 10:00 (heure locale)
const day = (offset: number) => new Date(2026, 9, 1 + offset);

function event(over: Partial<CalendarEventDTO>): CalendarEventDTO {
  return {
    id: "e1", title: "RDV Martin", type: "APPOINTMENT", categoryId: null, organizerId: "admin", agentRdvId: "robin",
    startAt: new Date(2026, 9, 1, 14, 0).toISOString(), endAt: new Date(2026, 9, 1, 15, 0).toISOString(),
    ...over,
  } as CalendarEventDTO;
}

function renderGrid(props: Partial<Parameters<typeof CalendarGrid>[0]> = {}) {
  const onSlotClick = vi.fn();
  render(
    <CalendarGrid
      days={[day(-1), day(0), day(1)]}
      events={[]}
      onSlotClick={onSlotClick}
      onEventClick={vi.fn()}
      canDrag={() => false}
      onEventDrop={vi.fn()}
      {...props}
    />,
  );
  return { onSlotClick };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("CalendarGrid — zone passée hachurée", () => {
  it("jour passé : colonne entière ; aujourd'hui : jusqu'à maintenant ; jour futur : aucune", () => {
    renderGrid();
    const zones = screen.getAllByTestId("past-zone");
    expect(zones.map((z) => z.style.height)).toEqual([`${14 * HOUR}px`, `${3 * HOUR}px`]);
  });

  it("clic dans le passé : rien ; clic après maintenant : création proposée", () => {
    const { onSlotClick } = renderGrid();
    const [, todayZone] = screen.getAllByTestId("past-zone");
    const todayColumn = todayZone!.parentElement!;

    fireEvent.click(todayZone!, { clientY: HOUR }); // 08:00, sur la zone hachurée
    fireEvent.click(todayColumn, { clientY: 2.9 * HOUR }); // ~09:54, arrondi à 10:00 = maintenant → permis
    fireEvent.click(todayColumn, { clientY: 1.5 * HOUR }); // 08:30 sous la zone (garde de la colonne) → rien
    fireEvent.click(todayColumn, { clientY: 4 * HOUR }); // 11:00

    expect(onSlotClick.mock.calls.map(([d]) => (d as Date).getHours() * 60 + (d as Date).getMinutes())).toEqual([600, 660]);
  });
});

describe("CalendarGrid — vue partagée", () => {
  it("bloc à la couleur de la personne, prénom visible, pas de poignée sans droit d'écriture", () => {
    const { container } = render(
      <CalendarGrid
        days={[day(0)]}
        events={[event({})]}
        onSlotClick={vi.fn()}
        onEventClick={vi.fn()}
        canDrag={() => false}
        onEventDrop={vi.fn()}
        personOf={() => ({ name: "Robin", color: "#F4B6B6" })}
      />,
    );
    const block = screen.getByRole("button", { name: /RDV Martin/ });
    expect(block).toHaveStyle({ backgroundColor: "#F4B6B6" });
    expect(block).toHaveTextContent("Robin");
    expect(container.querySelector(".cursor-ns-resize")).toBeNull();
  });

  it("glisser autorisé événement par événement (canDrag reçoit l'événement)", () => {
    const canDrag = vi.fn((e: CalendarEventDTO) => e.id === "mine");
    const { container } = render(
      <CalendarGrid
        days={[day(0)]}
        events={[event({ id: "mine", title: "À moi" }), event({ id: "other", title: "À un autre", startAt: new Date(2026, 9, 1, 17, 0).toISOString(), endAt: new Date(2026, 9, 1, 18, 0).toISOString() })]}
        onSlotClick={vi.fn()}
        onEventClick={vi.fn()}
        canDrag={canDrag}
        onEventDrop={vi.fn()}
      />,
    );
    expect(container.querySelectorAll(".cursor-ns-resize")).toHaveLength(2); // 2 poignées, un seul événement
    expect(screen.getByRole("button", { name: /À moi/ })).toHaveClass("cursor-grab");
    expect(screen.getByRole("button", { name: /À un autre/ })).not.toHaveClass("cursor-grab");
  });
});
