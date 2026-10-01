import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventDTO } from "@/lib/api/calendar";
import { ApiError } from "@/lib/api/client";
import { EventPanel } from "./EventPanel";

/** Sous-lot 4 délégation RDV — bouton Déléguer, flux complet, écart viewAll corrigé. */
const api = vi.hoisted(() => ({
  changeAppointmentStatus: vi.fn(),
  delegateAppointment: vi.fn(),
  getEvent: vi.fn(),
}));
vi.mock("@/lib/api/calendar", () => ({
  ...api,
  addAttendee: vi.fn(),
  createEvent: vi.fn(),
  createEventCategory: vi.fn(),
  createReminder: vi.fn(),
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
  listUsers: vi.fn().mockResolvedValue([
    { id: "a", firstName: "Alice", lastName: "Agent", email: "a@x.fr" },
    { id: "b", firstName: "Bruno", lastName: "Agent", email: "b@x.fr" },
    { id: "c", firstName: "Chloé", lastName: "Agent", email: "c@x.fr" },
  ]),
}));
vi.mock("@/lib/notifications/badgeSignal", () => ({ notifyNotificationsBadgeStale: vi.fn() }));

const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
let currentUser = { id: "a" };
let permissions: string[] = [];
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ authedFetch, user: currentUser, hasPermission: (p: string) => permissions.includes(p) }),
}));

const AGENT_RDV_PERMS = ["calendar.manageAppointments", "calendar.update"];
const ADMIN_PERMS = [...AGENT_RDV_PERMS, "calendar.viewAll"];

function appointment(status: "EN_ATTENTE_DE_CONFIRMATION" | "CONFIRME" = "EN_ATTENTE_DE_CONFIRMATION") {
  return {
    id: "e1", title: "RDV client", description: null, type: "APPOINTMENT", status,
    startAt: "2099-01-10T08:00:00.000Z", endAt: "2099-01-10T09:00:00.000Z",
    callId: "call1", agentRdvId: "a", categoryId: null, organizerId: "org",
  } as unknown as CalendarEventDTO;
}

function renderPanel(event = appointment()) {
  const onSaved = vi.fn();
  render(<EventPanel event={event} calendarId="cal1" canDelete={false} onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} />);
  return { onSaved };
}
const agentsLoaded = () => screen.findByRole("option", { name: "Bruno Agent" });
const queryButton = (name: string) => screen.queryByRole("button", { name });

beforeEach(() => {
  currentUser = { id: "a" };
  permissions = AGENT_RDV_PERMS;
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getEvent.mockResolvedValue({ attendees: [], conflicts: [], statusHistory: [] });
});

describe("délégation RDV — EventPanel", () => {
  it("admin (calendar.viewAll), ni organisateur ni agent : voit Confirmer, Refuser et Déléguer", async () => {
    currentUser = { id: "admin" };
    permissions = ADMIN_PERMS;
    renderPanel();
    await agentsLoaded();
    expect(queryButton("Confirmer")).toBeInTheDocument();
    expect(queryButton("Refuser")).toBeInTheDocument();
    expect(queryButton("Déléguer")).toBeInTheDocument();
  });

  it("sans viewAll et sans lien avec le RDV : aucun bouton (comme le backend)", async () => {
    currentUser = { id: "other" };
    permissions = AGENT_RDV_PERMS;
    renderPanel();
    await agentsLoaded();
    expect(queryButton("Confirmer")).not.toBeInTheDocument();
    expect(queryButton("Déléguer")).not.toBeInTheDocument();
  });

  it("agent RDV assigné sans viewAll : Confirmer/Refuser visibles, mais plus Déléguer (réservé à l'admin)", async () => {
    renderPanel();
    await agentsLoaded();
    expect(queryButton("Confirmer")).toBeInTheDocument();
    expect(queryButton("Refuser")).toBeInTheDocument();
    expect(queryButton("Déléguer")).not.toBeInTheDocument();
  });

  it("RDV confirmé (admin) : Déléguer visible, Confirmer/Refuser absents", async () => {
    currentUser = { id: "admin" };
    permissions = ADMIN_PERMS;
    renderPanel(appointment("CONFIRME"));
    await agentsLoaded();
    expect(queryButton("Déléguer")).toBeInTheDocument();
    expect(queryButton("Confirmer")).not.toBeInTheDocument();
    expect(queryButton("Refuser")).not.toBeInTheDocument();
  });

  it("flux complet (admin) : liste sans l'agent assigné, Transmettre → API puis fermeture/rafraîchissement", async () => {
    api.delegateAppointment.mockResolvedValue({ ...appointment(), agentRdvId: "b" });
    currentUser = { id: "admin" };
    permissions = ADMIN_PERMS;
    const { onSaved } = renderPanel();
    await agentsLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Déléguer" }));
    const select = screen.getByLabelText("Transmettre à");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Sélectionner un collègue…", "Bruno Agent", "Chloé Agent"]);

    const submit = screen.getByRole("button", { name: "Transmettre" });
    expect(submit).toBeDisabled();
    fireEvent.change(select, { target: { value: "b" } });
    fireEvent.change(screen.getByLabelText("Commentaire (optionnel)"), { target: { value: "  Indispo  " } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api.delegateAppointment).toHaveBeenCalledWith("e1", { toAgentId: "b", comment: "Indispo" }, "tok");
  });

  it("erreur serveur (ex. ping-pong) : message affiché, panneau conservé", async () => {
    api.delegateAppointment.mockRejectedValue(
      new ApiError(400, "Impossible de redéléguer ce rendez-vous à la personne qui vient de vous le déléguer"),
    );
    currentUser = { id: "admin" };
    permissions = ADMIN_PERMS;
    const { onSaved } = renderPanel();
    await agentsLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Déléguer" }));
    fireEvent.change(screen.getByLabelText("Transmettre à"), { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: "Transmettre" }));

    expect(await screen.findByText(/personne qui vient de vous le déléguer/)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  describe("sous-lot 6 — parcours de délégation complet", () => {
    const person = (id: string, firstName: string, lastName: string | null = "Agent") => ({ id, firstName, lastName });
    const ALICE = person("a", "Alice");
    const BRUNO = person("b", "Bruno");
    const CHLOE = person("c", "Chloé");
    const ADMIN = person("admin", "Admin", "Org");
    function row(
      id: string,
      kind: "DELEGATION" | "DELEGATION_RETURN" | null,
      oldStatus: string | null,
      extra: { from?: typeof ALICE; to?: typeof ALICE; by?: typeof ALICE; comment?: string; at: string },
    ) {
      return {
        id, kind, oldStatus, newStatus: "EN_ATTENTE_DE_CONFIRMATION", changedAt: extra.at,
        changedBy: extra.by ?? ADMIN, comment: extra.comment ?? null,
        fromAgentId: extra.from?.id ?? null, toAgentId: extra.to?.id ?? null,
        fromAgent: extra.from ?? null, toAgent: extra.to ?? null,
      };
    }
    const stepTexts = async () =>
      within(await screen.findByRole("list", { name: "Parcours de délégation" }))
        .getAllByRole("listitem")
        .map((li) => li.textContent);
    const DATE = String.raw`\d{2}/\d{2}/\d{4} \d{2}:\d{2}`;

    it("chaîne réelle (Bruno → Alice par l'admin, Alice → Chloé, Chloé refuse) : toutes les étapes, dans l'ordre", async () => {
      // Ordre de getEvent : du plus récent au plus ancien. h1 précède la ligne
      // d'origine h2 (ancienne chaîne) : il ne doit pas apparaître.
      api.getEvent.mockResolvedValue({
        attendees: [], conflicts: [],
        statusHistory: [
          row("h5", "DELEGATION_RETURN", "EN_ATTENTE_DE_CONFIRMATION",
            { from: CHLOE, to: ALICE, by: CHLOE, comment: "Pas dispo", at: "2099-01-05T11:00:00.000Z" }),
          row("h4", "DELEGATION", "EN_ATTENTE_DE_CONFIRMATION", { from: ALICE, to: CHLOE, by: ALICE, at: "2099-01-05T10:00:00.000Z" }),
          row("h3", "DELEGATION", "CONFIRME",
            { from: BRUNO, to: ALICE, by: ADMIN, comment: "Bruno en congé", at: "2099-01-05T09:00:00.000Z" }),
          row("h2", null, null, { at: "2099-01-04T09:00:00.000Z" }),
          row("h1", "DELEGATION", "EN_ATTENTE_DE_CONFIRMATION", { from: CHLOE, to: BRUNO, by: CHLOE, at: "2099-01-03T09:00:00.000Z" }),
        ],
      });
      renderPanel();
      const steps = await stepTexts();
      expect(steps).toHaveLength(3);
      expect(steps[0]).toMatch(new RegExp(`^Bruno Agent → Alice Agent \\(par Admin Org\\) · ${DATE} — « Bruno en congé »$`));
      expect(steps[1]).toMatch(new RegExp(`^Alice Agent → Chloé Agent · ${DATE}$`));
      expect(steps[2]).toMatch(new RegExp(`^Chloé Agent a refusé, renvoyé à Alice Agent · ${DATE} — « Pas dispo »$`));
    });

    it("délégation depuis un RDV non assigné puis refus : « Non assigné » aux deux bouts", async () => {
      api.getEvent.mockResolvedValue({
        attendees: [], conflicts: [],
        statusHistory: [
          row("h3", "DELEGATION_RETURN", "EN_ATTENTE_DE_CONFIRMATION", { from: BRUNO, by: BRUNO, at: "2099-01-05T10:00:00.000Z" }),
          row("h2", "DELEGATION", "EN_ATTENTE_DE_CONFIRMATION", { to: BRUNO, by: ADMIN, at: "2099-01-05T09:00:00.000Z" }),
          row("h1", null, null, { at: "2099-01-04T09:00:00.000Z" }),
        ],
      });
      renderPanel({ ...appointment(), agentRdvId: null } as unknown as CalendarEventDTO);
      const steps = await stepTexts();
      expect(steps[0]).toMatch(/^Non assigné → Bruno Agent \(par Admin Org\) · /);
      expect(steps[1]).toMatch(/^Bruno Agent a refusé, renvoyé à Non assigné · /);
    });

    it("RDV confirmé après délégation : le parcours reste affiché", async () => {
      api.getEvent.mockResolvedValue({
        attendees: [], conflicts: [],
        statusHistory: [
          { ...row("h3", null, "EN_ATTENTE_DE_CONFIRMATION", { by: ALICE, at: "2099-01-05T10:00:00.000Z" }), newStatus: "CONFIRME" },
          row("h2", "DELEGATION", "EN_ATTENTE_DE_CONFIRMATION", { from: BRUNO, to: ALICE, by: BRUNO, at: "2099-01-05T09:00:00.000Z" }),
          row("h1", null, null, { at: "2099-01-04T09:00:00.000Z" }),
        ],
      });
      renderPanel(appointment("CONFIRME"));
      expect(await stepTexts()).toEqual([expect.stringMatching(/^Bruno Agent → Alice Agent · /)]);
    });

    it("RDV jamais délégué : aucun parcours affiché", async () => {
      api.getEvent.mockResolvedValue({
        attendees: [], conflicts: [],
        statusHistory: [row("h1", null, null, { at: "2099-01-04T09:00:00.000Z" })],
      });
      renderPanel();
      await agentsLoaded();
      await waitFor(() => expect(api.getEvent).toHaveBeenCalled());
      expect(screen.queryByText("Parcours de délégation")).not.toBeInTheDocument();
    });
  });

  describe("sous-lot 5 — champ « Agent RDV » : libre à la création, verrouillé en édition", () => {
    it("création d'un RDV : champ modifiable (première assignation), pas de bouton Déléguer", async () => {
      render(
        <EventPanel
          prefill={{ title: "Nouveau RDV", callId: "call1" }}
          calendarId="cal1"
          canDelete={false}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onDeleted={vi.fn()}
        />,
      );
      await agentsLoaded();
      const select = screen.getByLabelText("Agent RDV");
      expect(select).toBeEnabled();
      fireEvent.change(select, { target: { value: "b" } });
      expect(select).toHaveValue("b");
      expect(queryButton("Déléguer")).not.toBeInTheDocument();
    });

    it("édition d'un RDV existant par l'agent assigné : champ désactivé, renvoi vers l'admin", async () => {
      renderPanel();
      await agentsLoaded();
      const select = screen.getByLabelText("Agent RDV");
      expect(select).toBeDisabled();
      expect(select).toHaveValue("a");
      expect(queryButton("Déléguer")).not.toBeInTheDocument();
      expect(screen.getByText("Pour changer d'agent, demandez à un administrateur.")).toBeInTheDocument();
    });

    it("édition d'un RDV existant par l'admin : Déléguer seul chemin (indication affichée)", async () => {
      currentUser = { id: "admin" };
      permissions = ADMIN_PERMS;
      renderPanel();
      await agentsLoaded();
      expect(screen.getByLabelText("Agent RDV")).toBeDisabled();
      expect(queryButton("Déléguer")).toBeInTheDocument();
      expect(screen.getByText("Pour changer d'agent, utilisez « Déléguer ».")).toBeInTheDocument();
    });

    it("édition même pour un admin (viewAll) : champ toujours désactivé", async () => {
      currentUser = { id: "admin" };
      permissions = ADMIN_PERMS;
      renderPanel();
      await agentsLoaded();
      expect(screen.getByLabelText("Agent RDV")).toBeDisabled();
    });

    it("événement existant qui DEVIENT un RDV : champ modifiable (première assignation)", async () => {
      const meeting = { ...appointment(), type: "MEETING", status: null, agentRdvId: null, callId: null, organizerId: "a" } as unknown as CalendarEventDTO;
      renderPanel(meeting);
      fireEvent.change(await screen.findByLabelText("Type"), { target: { value: "APPOINTMENT" } });
      await agentsLoaded();
      expect(screen.getByLabelText("Agent RDV")).toBeEnabled();
    });
  });

  it("refus d'un RDV reçu par délégation (renvoyé au délégant) : panneau fermé", async () => {
    api.changeAppointmentStatus.mockResolvedValue({ ...appointment(), agentRdvId: "c" });
    const { onSaved } = renderPanel();
    await agentsLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Refuser" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le refus" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});
