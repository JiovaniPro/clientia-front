import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventDTO } from "@/lib/api/calendar";
import { EventPanel } from "./EventPanel";

/** §6.25 lot D — garde sur EventPanel. */
const api = vi.hoisted(() => ({
  addAttendee: vi.fn(),
  createEventCategory: vi.fn(),
  createReminder: vi.fn(),
  deleteEventCategory: vi.fn(),
}));
vi.mock("@/lib/api/calendar", () => ({
  ...api,
  changeAppointmentStatus: vi.fn(),
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  deleteReminder: vi.fn(),
  getAgentAvailability: vi.fn().mockResolvedValue({ busyCount: 0 }),
  getEvent: vi.fn().mockResolvedValue({ attendees: [], conflicts: [] }),
  listEventCategories: vi.fn().mockResolvedValue([{ id: "cat1", name: "Client", color: "#111" }]),
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
const panelLoaded = () => screen.findByRole("option", { name: "Client" });
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

  it("nom de catégorie tapé : confirmation ; sous-formulaire refermé (« Annuler ») : abandon, fermeture directe", async () => {
    const { onClose } = renderPanel();
    await panelLoaded();
    fireEvent.click(screen.getByRole("button", { name: "+ Nouvelle catégorie" }));
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Prospects" } });
    closeWays["×"]!();
    expectGuard(onClose);

    fireEvent.click(screen.getByRole("button", { name: "Continuer la modification" }));
    fireEvent.click(within(screen.getByText("Catégorie").parentElement!).getByRole("button", { name: "Annuler" }));
    closeWays["×"]!();
    expectClosedDirectly(onClose);
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

  it("suppression de la catégorie de l'événement (déjà enregistrée, le tag disparaît aussi côté serveur) : pas de fausse modification", async () => {
    api.deleteEventCategory.mockResolvedValue(undefined);
    const { onClose } = renderPanel();
    await panelLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la catégorie" }));
    fireEvent.click(within(screen.getByText("Supprimer cette catégorie").closest("div.rounded-lg") as HTMLElement).getByRole("button", { name: "Supprimer" }));
    await vi.waitFor(() => expect(screen.getByLabelText("Catégorie")).toHaveValue(""));
    closeWays["×"]!();
    expectClosedDirectly(onClose);
  });

  it("catégorie créée : la création ne compte pas, mais sa sélection automatique sur l'événement (non enregistrée) oui", async () => {
    api.createEventCategory.mockResolvedValue({ id: "cat2", name: "Prospects", color: "#c2410c" });
    const { onClose } = renderPanel();
    await panelLoaded();
    fireEvent.click(screen.getByRole("button", { name: "+ Nouvelle catégorie" }));
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Prospects" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await vi.waitFor(() => expect(screen.getByLabelText("Catégorie")).toHaveValue("cat2"));
    closeWays["×"]!();
    expectGuard(onClose);

    // Revenir à la catégorie d'origine : la garde ne se déclenche plus (la création seule ne compte pas).
    fireEvent.click(screen.getByRole("button", { name: "Continuer la modification" }));
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: "cat1" } });
    closeWays["×"]!();
    expectClosedDirectly(onClose);
  });

  it("lecture seule : jamais de confirmation, quelle que soit l'interaction", async () => {
    currentUser = { id: "someone-else" }; // ni organisateur, ni agent RDV, ni calendar.viewAll
    const { onClose } = renderPanel();
    await panelLoaded();
    expect(screen.getByLabelText("Titre")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Forcé" } });
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: "" } });
    for (const close of Object.values(closeWays)) close();
    expect(onClose).toHaveBeenCalledTimes(4);
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
  });
});
