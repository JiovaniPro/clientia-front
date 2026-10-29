import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventDTO } from "@/lib/api/calendar";
import { EventPanel } from "./EventPanel";

/** §6.25 lot D — garde sur EventPanel. */
const api = vi.hoisted(() => ({
  addAttendee: vi.fn(),
  createReminder: vi.fn(),
}));
vi.mock("@/lib/api/calendar", () => ({
  ...api,
  changeAppointmentStatus: vi.fn(),
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  deleteReminder: vi.fn(),
  getAgentAvailability: vi.fn().mockResolvedValue({ busyCount: 0 }),
  getEvent: vi.fn().mockResolvedValue({ attendees: [], conflicts: [] }),
  listReminders: vi.fn().mockResolvedValue([]),
  removeAttendee: vi.fn(),
  resolveConflict: vi.fn(),
  suggestSlots: vi.fn(),
  updateAttendeeStatus: vi.fn(),
  updateEvent: vi.fn(),
}));
vi.mock("@/lib/api/calls", () => ({ getCall: vi.fn(), listCalls: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock("@/lib/api/users", () => ({ listUsers: vi.fn().mockResolvedValue([]) }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
let currentUser = { id: "u1" };
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ authedFetch, user: currentUser, hasPermission: () => false }),
}));

const GUARD_TITLE = "Modifications non enregistrées";
const EVENT = {
  id: "e1", title: "Point hebdo", description: null, type: "MEETING", status: null,
  startAt: "2026-09-30T08:00:00.000Z", endAt: "2026-09-30T09:00:00.000Z",
  callId: null, agentRdvId: null, categoryId: "cat1", organizerId: "u1",
} as unknown as CalendarEventDTO;

function renderPanel() {
  const onClose = vi.fn();
  render(<EventPanel event={EVENT} calendarId="cal1" canDelete onClose={onClose} onSaved={vi.fn()} onDeleted={vi.fn()} />);
  return { onClose };
}
const panelLoaded = () => screen.findByLabelText("Titre");
const closeWays: Record<string, () => void> = {
  "×": () => fireEvent.click(screen.getAllByRole("button", { name: "Fermer" })[0]!),
  Échap: () => fireEvent.keyDown(window, { key: "Escape" }),
  fond: () => fireEvent.click(screen.getByText("Modifier l'événement").closest(".fixed") as HTMLElement),
  // Bouton du pied : "Annuler", ou "Fermer" en lecture seule (le dernier — × porte aussi le nom "Fermer").
  "Annuler/Fermer": () => fireEvent.click(screen.getAllByRole("button", { name: /^(Annuler|Fermer)$/ }).at(-1)!),
};
const expectClosedDirectly = (onClose: () => void) => {
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
};
const expectGuard = (onClose: () => void) => {
  expect(screen.getByText(GUARD_TITLE)).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
};
const openExternalAttendee = () => fireEvent.click(screen.getByRole("button", { name: "Externe (email)" }));

beforeEach(() => {
  currentUser = { id: "u1" };
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe("§6.25 lot D — EventPanel", () => {
  for (const [way, close] of Object.entries(closeWays)) {
    it(`${way} sans modification : fermeture directe`, async () => {
      const { onClose } = renderPanel();
      await panelLoaded();
      close();
      expectClosedDirectly(onClose);
    });
  }

  it("champ principal modifié (titre) : confirmation", async () => {
    const { onClose } = renderPanel();
    await panelLoaded();
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Point mensuel" } });
    closeWays["×"]!();
    expectGuard(onClose);
  });

  it("saisie secondaire non validée (e-mail d'invité tapé, pas ajouté) : confirmation", async () => {
    const { onClose } = renderPanel();
    await panelLoaded();
    openExternalAttendee();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invite@exemple.com" } });
    closeWays["×"]!();
    expectGuard(onClose);
  });


  it("invité ajouté avec succès (déjà enregistré) : pas de fausse modification", async () => {
    api.addAttendee.mockResolvedValue({ id: "a1", email: "invite@exemple.com", name: null, userId: null, role: "REQUIRED", status: "PENDING" });
    const { onClose } = renderPanel();
    await panelLoaded();
    openExternalAttendee();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invite@exemple.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Inviter" }));
    await screen.findByText(/invite@exemple\.com ·/);
    closeWays["×"]!();
    expectClosedDirectly(onClose);
  });

  it("rappel ajouté avec succès (délai changé, jamais vidé ensuite) : pas de fausse modification", async () => {
    api.createReminder.mockResolvedValue({ id: "r1", minutesBefore: 30, method: "POPUP" });
    const { onClose } = renderPanel();
    await panelLoaded();
    fireEvent.change(await screen.findByLabelText("Minutes avant"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await screen.findByText(/30 min avant/);
    closeWays["×"]!();
    expectClosedDirectly(onClose);
  });

  it("rappel popup + e-mail cochés ensemble : un rappel créé par méthode", async () => {
    api.createReminder.mockReset();
    api.createReminder
      .mockResolvedValueOnce({ id: "r1", minutesBefore: 15, method: "POPUP" })
      .mockResolvedValueOnce({ id: "r2", minutesBefore: 15, method: "EMAIL" });
    renderPanel();
    await panelLoaded();
    fireEvent.change(await screen.findByLabelText("Minutes avant"), { target: { value: "15" } });
    fireEvent.click(screen.getByLabelText("E-mail"));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await screen.findByText("15 min avant · E-mail");
    expect(screen.getByText("15 min avant · Popup (application)")).toBeInTheDocument();
    expect(api.createReminder.mock.calls.map((c) => c[1])).toEqual([
      { minutesBefore: 15, method: "POPUP" },
      { minutesBefore: 15, method: "EMAIL" },
    ]);
  });

  it("lecture seule : jamais de confirmation, quelle que soit l'interaction", async () => {
    currentUser = { id: "someone-else" }; // ni organisateur, ni agent RDV, ni calendar.viewAll
    const { onClose } = renderPanel();
    await panelLoaded();
    expect(screen.getByLabelText("Titre")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Forcé" } });
    for (const close of Object.values(closeWays)) close();
    expect(onClose).toHaveBeenCalledTimes(4);
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
  });
});
