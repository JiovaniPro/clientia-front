import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventDTO } from "@/lib/api/calendar";
import { EventPanel } from "./EventPanel";

/** Sous-lot 3 honoré/manqué — marquage, ligne d'état, correction, visibilité par rôle. */
const api = vi.hoisted(() => ({ getEvent: vi.fn(), markAttendance: vi.fn() }));
vi.mock("@/lib/api/calendar", () => ({
  ...api,
  addAttendee: vi.fn(),
  changeAppointmentStatus: vi.fn(),
  createEvent: vi.fn(),
  createEventCategory: vi.fn(),
  createReminder: vi.fn(),
  delegateAppointment: vi.fn(),
  deleteEvent: vi.fn(),
  deleteEventCategory: vi.fn(),
  deleteReminder: vi.fn(),
  getAgentAvailability: vi.fn().mockResolvedValue({ busyCount: 0 }),
  listEventCategories: vi.fn().mockResolvedValue([]),
  listReminders: vi.fn().mockResolvedValue([]),
  removeAttendee: vi.fn(),
  resolveConflict: vi.fn(),
  suggestSlots: vi.fn(),
  updateAttendeeStatus: vi.fn(),
  updateEvent: vi.fn(),
}));
vi.mock("@/lib/api/calls", () => ({ getCall: vi.fn(), listCalls: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock("@/lib/api/users", () => ({
  listUsers: vi.fn().mockResolvedValue([{ id: "a", firstName: "Alice", lastName: "Agent", email: "a@x.fr" }]),
}));

const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
let currentUser = { id: "a" };
let permissions: string[] = [];
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ authedFetch, user: currentUser, hasPermission: (p: string) => permissions.includes(p) }),
}));

const AGENT_RDV_PERMS = ["calendar.manageAppointments", "calendar.update"];
const ADMIN_PERMS = [...AGENT_RDV_PERMS, "calendar.viewAll"];
const ALICE = { id: "a", firstName: "Alice", lastName: "Agent" };
const HOUR = 3_600_000;

function appointment(opts: { status?: string; startOffsetHours?: number; organizerId?: string } = {}) {
  const start = new Date(Date.now() + (opts.startOffsetHours ?? -3) * HOUR);
  return {
    id: "e1", title: "RDV client", description: null, type: "APPOINTMENT", status: opts.status ?? "CONFIRME",
    startAt: start.toISOString(), endAt: new Date(start.getTime() + HOUR).toISOString(),
    callId: "call1", agentRdvId: "a", categoryId: null, organizerId: opts.organizerId ?? "org",
    attended: null, attendanceMarkedAt: null, attendanceMarkedById: null,
  } as unknown as CalendarEventDTO;
}

function marked(attended: boolean) {
  return { attended, attendanceMarkedAt: "2099-01-05T09:30:00.000Z", attendanceMarkedById: "a", attendanceMarkedBy: ALICE };
}

function renderPanel(event = appointment()) {
  render(<EventPanel event={event} calendarId="cal1" canDelete={false} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />);
}
const loaded = () => waitFor(() => expect(api.getEvent).toHaveBeenCalled()).then(() => screen.findByRole("option", { name: "Alice Agent" }));
const queryButton = (name: string) => screen.queryByRole("button", { name });
const presenceLine = () =>
  screen.queryByText((_, el) => el?.tagName === "P" && (el.textContent ?? "").startsWith("Présence : "));
const DATE = /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;

beforeEach(() => {
  currentUser = { id: "a" };
  permissions = AGENT_RDV_PERMS;
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getEvent.mockResolvedValue({ attendees: [], conflicts: [], statusHistory: [], attended: null });
});

describe("suivi honoré/manqué — EventPanel", () => {
  it("RDV éligible non marqué : boutons Honoré/Manqué, sans Déléguer ni ligne d'état ; clic → ligne d'état + correction", async () => {
    api.markAttendance.mockResolvedValue({ ...appointment(), ...marked(true) });
    renderPanel();
    await loaded();

    expect(queryButton("Honoré")).toBeInTheDocument();
    expect(queryButton("Manqué")).toBeInTheDocument();
    expect(queryButton("Déléguer")).not.toBeInTheDocument(); // exclusifs : RDV passé
    expect(presenceLine()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Honoré" }));
    await waitFor(() => expect(presenceLine()).not.toBeNull());
    expect(api.markAttendance).toHaveBeenCalledWith("e1", { attended: true }, "tok");
    expect(presenceLine()?.textContent).toMatch(/^Présence : Honoré · marqué par Alice Agent le /);
    expect(queryButton("Honoré")).not.toBeInTheDocument();
    expect(queryButton("Corriger : marquer manqué")).toBeInTheDocument();
  });

  it("RDV marqué honoré : ligne d'état complète + correction vers manqué", async () => {
    api.getEvent.mockResolvedValue({ attendees: [], conflicts: [], statusHistory: [], ...marked(true) });
    api.markAttendance.mockResolvedValue({ ...appointment(), ...marked(false) });
    renderPanel();
    await waitFor(() => expect(presenceLine()).not.toBeNull());

    expect(presenceLine()?.textContent).toMatch(/^Présence : Honoré · marqué par Alice Agent le /);
    expect(presenceLine()?.textContent).toMatch(DATE);
    expect(queryButton("Honoré")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Corriger : marquer manqué" }));
    await waitFor(() => expect(presenceLine()?.textContent).toMatch(/^Présence : Manqué · /));
    expect(api.markAttendance).toHaveBeenCalledWith("e1", { attended: false }, "tok");
    expect(queryButton("Corriger : marquer honoré")).toBeInTheDocument();
  });

  it("RDV marqué manqué : ligne d'état + correction vers honoré", async () => {
    api.getEvent.mockResolvedValue({ attendees: [], conflicts: [], statusHistory: [], ...marked(false) });
    renderPanel();
    await waitFor(() => expect(presenceLine()?.textContent).toMatch(/^Présence : Manqué · marqué par Alice Agent le /));
    expect(queryButton("Corriger : marquer honoré")).toBeInTheDocument();
  });

  it("RDV marqué, lecteur sans droit de marquer : ligne d'état visible, aucune correction", async () => {
    currentUser = { id: "b" };
    permissions = ["calendar.viewAll"]; // peut lire, pas calendar.manageAppointments
    api.getEvent.mockResolvedValue({ attendees: [], conflicts: [], statusHistory: [], ...marked(true) });
    renderPanel();
    await waitFor(() => expect(presenceLine()).not.toBeNull());
    expect(queryButton("Corriger : marquer manqué")).not.toBeInTheDocument();
  });

  it.each([
    ["RDV futur confirmé", { startOffsetHours: 24 }],
    ["RDV en cours", { startOffsetHours: -0.5 }],
    ["RDV passé en attente", { status: "EN_ATTENTE_DE_CONFIRMATION" }],
    ["RDV passé refusé", { status: "REFUSE" }],
  ])("non éligible (%s) : ni boutons ni ligne d'état", async (_, opts) => {
    renderPanel(appointment(opts));
    await loaded();
    expect(queryButton("Honoré")).not.toBeInTheDocument();
    expect(queryButton("Manqué")).not.toBeInTheDocument();
    expect(presenceLine()).toBeNull();
  });

  it("non éligible (RDV futur confirmé) : état actuel inchangé, Déléguer toujours proposé (admin)", async () => {
    currentUser = { id: "admin" };
    permissions = ADMIN_PERMS;
    renderPanel(appointment({ startOffsetHours: 24 }));
    await loaded();
    expect(queryButton("Déléguer")).toBeInTheDocument();
  });

  it("admin (calendar.viewAll), RDV d'un autre agent : voit Honoré/Manqué", async () => {
    currentUser = { id: "admin" };
    permissions = ADMIN_PERMS;
    renderPanel();
    await loaded();
    expect(queryButton("Honoré")).toBeInTheDocument();
    expect(queryButton("Manqué")).toBeInTheDocument();
  });

  it("agent RDV non assigné : ne voit pas les boutons", async () => {
    currentUser = { id: "b" };
    renderPanel();
    await loaded();
    expect(queryButton("Honoré")).not.toBeInTheDocument();
  });

  it("agent RDV organisateur mais non assigné : ne voit pas les boutons (contrôle strict)", async () => {
    currentUser = { id: "b" };
    renderPanel(appointment({ organizerId: "b" }));
    await loaded();
    expect(queryButton("Honoré")).not.toBeInTheDocument();
  });
});
