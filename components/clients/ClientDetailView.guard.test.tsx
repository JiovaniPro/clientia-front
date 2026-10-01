import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientDetailDTO } from "@/lib/api/clients";
import { ClientDetailView } from "./ClientDetailView";

/** §6.25 lot E — deux sections, deux gardes (beforeunload), et plus d'écrasement croisé. */
const updateClient = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/api/clients", () => ({
  getClient: vi.fn(() => Promise.resolve(CLIENT)),
  updateClient: (...a: unknown[]) => updateClient(...a),
  deleteClient: vi.fn(),
}));
vi.mock("@/lib/api/configurableLists", () => ({
  getConfigurableList: vi.fn((key: string) =>
    Promise.resolve(
      key === "CLIENT_FINAL_STATUS"
        ? [{ id: "f1", key: "EN_COURS", label: "En cours" }, { id: "f2", key: "SIGNE", label: "Signé" }]
        : [{ id: `${key}-1`, key: "K", label: "Statut" }],
    ),
  ),
}));
vi.mock("@/components/clients/SendEmailModal", () => ({ SendEmailModal: () => null }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ authedFetch, user: { id: "u1", permissions: ["clients.editFinalStatus", "clients.viewAll"] } }),
}));

const st = { id: "x", key: "K", label: "Statut", color: "#111" };
const CLIENT = {
  id: "c1", firstName: "Alice", lastName: "Test", phoneNumber: "+33600000001", email: null, agentId: "u1",
  dossierStatus: st, finalStatus: { ...st, key: "EN_COURS" }, civilite: null, maritalStatus: null, children: null,
  typeRdv: null, country: { label: "France" }, adresse: null, comment: null,
  createdAt: new Date(2026, 8, 21).toISOString(), telephoniste: null, agent: null,
} as unknown as ClientDetailDTO;

function beforeUnloadBlocked() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
const loaded = () => screen.findByLabelText("Adresse");
const typeAdresse = (value: string) => fireEvent.change(screen.getByLabelText("Adresse"), { target: { value } });
const setFinalStatus = (value: string) => fireEvent.change(screen.getByLabelText("Nouveau statut final"), { target: { value } });

beforeEach(() => updateClient.mockReset());

describe("§6.25 lot E — ClientDetailView", () => {
  it("dossier chargé, rien modifié : beforeunload inactif (pas de faux positif au chargement)", async () => {
    render(<ClientDetailView clientId="c1" />);
    await loaded();
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it("section Informations : actif après modification, inactif après enregistrement réussi", async () => {
    updateClient.mockResolvedValue({ ...CLIENT, adresse: "12 rue des Lilas" });
    render(<ClientDetailView clientId="c1" />);
    await loaded();
    typeAdresse("12 rue des Lilas");
    expect(beforeUnloadBlocked()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Dossier mis à jour.");
    // La réinitialisation de la garde se fait dans un effet, possiblement après l'affichage du message.
    await vi.waitFor(() => expect(beforeUnloadBlocked()).toBe(false));
    expect(screen.getByLabelText("Adresse")).toHaveValue("12 rue des Lilas");
  });

  it("section Statut final : actif après modification, inactif après enregistrement réussi", async () => {
    updateClient.mockResolvedValue({ ...CLIENT, finalStatus: { ...st, key: "SIGNE" } });
    render(<ClientDetailView clientId="c1" />);
    await loaded();
    setFinalStatus("SIGNE");
    expect(beforeUnloadBlocked()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le statut final" }));
    await screen.findByText("Statut final mis à jour.");
    await vi.waitFor(() => expect(beforeUnloadBlocked()).toBe(false));
  });

  it("enregistrer le statut final n'écrase plus la saisie non enregistrée des Informations", async () => {
    // Le serveur ne connaît pas l'adresse tapée : il renvoie toujours adresse = null.
    updateClient.mockResolvedValue({ ...CLIENT, finalStatus: { ...st, key: "SIGNE" } });
    render(<ClientDetailView clientId="c1" />);
    await loaded();
    typeAdresse("Saisie non enregistrée");
    setFinalStatus("SIGNE");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le statut final" }));
    await vi.waitFor(() => expect(updateClient).toHaveBeenCalledWith("c1", { finalStatusKey: "SIGNE" }, "tok"));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Enregistrer le statut final" })).toBeEnabled());

    expect(screen.getByLabelText("Adresse")).toHaveValue("Saisie non enregistrée");
    expect(screen.getByLabelText("Nouveau statut final")).toHaveValue("SIGNE");
    expect(beforeUnloadBlocked()).toBe(true); // la garde des Informations est intacte
  });

  it("et réciproquement : enregistrer les Informations n'écrase pas un statut final non enregistré", async () => {
    updateClient.mockResolvedValue({ ...CLIENT, adresse: "12 rue des Lilas" });
    render(<ClientDetailView clientId="c1" />);
    await loaded();
    setFinalStatus("SIGNE");
    typeAdresse("12 rue des Lilas");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled());

    expect(screen.getByLabelText("Nouveau statut final")).toHaveValue("SIGNE");
    expect(beforeUnloadBlocked()).toBe(true); // la garde du statut final est intacte
  });

  it("champ E-mail : affiché dans Informations, envoyé à l'enregistrement, et compté comme modification non enregistrée", async () => {
    updateClient.mockResolvedValue({ ...CLIENT, email: "alice@exemple.fr" });
    render(<ClientDetailView clientId="c1" />);
    await loaded();
    const field = screen.getByLabelText("E-mail");
    expect(field).toHaveValue("");

    fireEvent.change(field, { target: { value: "alice@exemple.fr" } });
    expect(beforeUnloadBlocked()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() =>
      expect(updateClient).toHaveBeenCalledWith("c1", expect.objectContaining({ email: "alice@exemple.fr" }), "tok"),
    );
    await screen.findByText("Dossier mis à jour.");
    expect(screen.getByLabelText("E-mail")).toHaveValue("alice@exemple.fr");
  });
});
