import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentRdvClientsPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/components/clients/SendEmailModal", () => ({
  SendEmailModal: ({ clientEmail }: { clientEmail: string | null }) => <div role="dialog">Envoi à {clientEmail}</div>,
}));

const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

const listClients = vi.fn();
vi.mock("@/lib/api/clients", () => ({ listClients: (...a: unknown[]) => listClients(...a) }));
const getConfigurableList = vi.fn();
vi.mock("@/lib/api/configurableLists", () => ({ getConfigurableList: (...a: unknown[]) => getConfigurableList(...a) }));

const status = (key: string, label: string, color: string, order: number) => ({
  id: key, listKey: "X", key, label, color, order, isActive: true, isDefault: false, metadata: null,
});
const DOSSIER = [status("NOUVEAU", "Nouveau", "#6B7280", 0), status("EN_COURS", "En cours", "#D97706", 1)];
const FINAL = [status("EN_ATTENTE", "En attente", "#111111", 0), status("VALIDE", "Dossier validé", "#16A34A", 1)];

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(10, 0, 0, 0);

function client(id: string, over: Record<string, unknown> = {}) {
  return {
    id, firstName: "Camille", lastName: "Rochat", phoneNumber: "+41 79 482 15 36", email: "camille@example.com",
    dossierStatus: DOSSIER[0], finalStatus: FINAL[0], nextAppointmentAt: null, ...over,
  };
}
const CLIENTS = [
  client("c1", { nextAppointmentAt: tomorrow.toISOString() }),
  client("c2", { firstName: "Julien", lastName: "Moreau", email: null }),
];

beforeEach(() => {
  localStorage.clear();
  push.mockReset();
  listClients.mockReset();
  // Puces : 2 dossiers « Nouveau », 1 « En cours », 3 au total ; liste : toujours CLIENTS.
  listClients.mockImplementation((filters: { dossierStatusKey?: string; pageSize?: number }) => {
    if (filters.pageSize === 1) {
      const total = filters.dossierStatusKey === "NOUVEAU" ? 2 : filters.dossierStatusKey === "EN_COURS" ? 1 : 3;
      return Promise.resolve({ items: [], total, page: 1, pageSize: 1 });
    }
    return Promise.resolve({ items: CLIENTS, total: CLIENTS.length, page: 1, pageSize: 24 });
  });
  getConfigurableList.mockImplementation((key: string) => Promise.resolve(key === "CLIENT_DOSSIER_STATUS" ? DOSSIER : FINAL));
});

describe("/agent-rdv/clients", () => {
  it("cartes : nom, e-mail, prochain RDV en clair (« Demain »), statuts ; carte cliquable vers le dossier", async () => {
    render(<AgentRdvClientsPage />);

    const card = (await screen.findByRole("link", { name: "Camille Rochat" })).closest("article")!;
    expect(screen.getByRole("link", { name: "Camille Rochat" })).toHaveAttribute("href", "/clients/c1");
    expect(within(card).getByText("camille@example.com")).toBeInTheDocument();
    expect(within(card).getByText("Demain")).toBeInTheDocument();
    expect(within(card).getByText("10:00")).toBeInTheDocument();
    expect(within(card).getByText("Nouveau")).toBeInTheDocument();
    expect(within(card).getByText("En attente")).toBeInTheDocument();
    // Un dossier sans RDV le dit.
    expect(screen.getByText("Aucun RDV planifié")).toBeInTheDocument();
  });

  it("puces de statut avec le nombre de dossiers ; en choisir une filtre la liste, la re-cliquer la retire", async () => {
    render(<AgentRdvClientsPage />);
    const group = await screen.findByRole("group", { name: "Statut du dossier" });
    expect(within(group).getByRole("button", { name: /Tous\s*3/ })).toHaveAttribute("aria-pressed", "true");
    const enCours = within(group).getByRole("button", { name: /En cours\s*1/ });

    fireEvent.click(enCours);
    await waitFor(() => expect(listClients).toHaveBeenCalledWith(expect.objectContaining({ dossierStatusKey: "EN_COURS", page: 1, pageSize: 24 }), "tok"));
    expect(enCours).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(enCours);
    expect(enCours).toHaveAttribute("aria-pressed", "false");
    expect(within(group).getByRole("button", { name: /Tous/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("statut final : le choix est transmis au serveur", async () => {
    render(<AgentRdvClientsPage />);
    const select = await screen.findByRole("combobox", { name: "Statut final" });
    await screen.findByRole("option", { name: "Dossier validé" });

    fireEvent.change(select, { target: { value: "VALIDE" } });

    await waitFor(() => expect(listClients).toHaveBeenCalledWith(expect.objectContaining({ finalStatusKey: "VALIDE" }), "tok"));
  });

  it("recherche : appliquée après la saisie, effaçable, et « / » y mène", async () => {
    render(<AgentRdvClientsPage />);
    await screen.findByRole("link", { name: "Camille Rochat" });
    const input = screen.getByRole("searchbox", { name: "Rechercher un client" });

    fireEvent.keyDown(document.body, { key: "/" });
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "moreau" } });
    await waitFor(() => expect(listClients).toHaveBeenCalledWith(expect.objectContaining({ search: "moreau" }), "tok"), { timeout: 2000 });

    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(input).toHaveValue("");
  });

  it("aucun résultat avec des filtres : message dédié et réinitialisation ; sans filtre : message d'accueil", async () => {
    listClients.mockImplementation((filters: { pageSize?: number; search?: string }) =>
      Promise.resolve({ items: [], total: filters.pageSize === 1 ? 0 : 0, page: 1, pageSize: filters.pageSize ?? 24 }),
    );
    render(<AgentRdvClientsPage />);
    expect(await screen.findByText("Aucun client ne vous est encore assigné.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un client" }), { target: { value: "zzz" } });
    expect(await screen.findByText("Aucun client ne correspond à « zzz ».", {}, { timeout: 2000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Réinitialiser les filtres/ }));
    expect(await screen.findByText("Aucun client ne vous est encore assigné.")).toBeInTheDocument();
  });

  it("e-mail depuis la carte : désactivé sans adresse, ouvre l'envoi sinon", async () => {
    render(<AgentRdvClientsPage />);
    await screen.findByRole("link", { name: "Camille Rochat" });
    const buttons = screen.getAllByRole("button", { name: /Envoyer un e-mail/ });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();

    fireEvent.click(buttons[0]!);
    expect(screen.getByRole("dialog")).toHaveTextContent("camille@example.com");
  });

  it("vue liste : tableau, mémorisée ; une ligne ouvre le dossier", async () => {
    render(<AgentRdvClientsPage />);
    await screen.findByRole("link", { name: "Camille Rochat" });

    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    const table = await screen.findByRole("table");
    expect(localStorage.getItem("clientia:agent-rdv-clients-view")).toBe("list");
    expect(screen.getByRole("button", { name: "Liste" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(table).getByText("Julien Moreau"));
    expect(push).toHaveBeenCalledWith("/clients/c2");

    fireEvent.click(screen.getByRole("button", { name: "Cartes" }));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("échec de chargement : message avec relance", async () => {
    listClients.mockRejectedValueOnce(new Error("boom"));
    render(<AgentRdvClientsPage />);
    expect(await screen.findByText("Impossible de charger vos dossiers clients.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
    expect(await screen.findByRole("link", { name: "Camille Rochat" })).toBeInTheDocument();
  });
});
