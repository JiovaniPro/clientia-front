import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ClientListItemDTO } from "@/lib/api/clients";
import ClientsPage from "./page";

const listClients = vi.fn();
const deleteClient = vi.fn();
let permissions: string[] = [];

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/api/clients", () => ({
  listClients: (...a: unknown[]) => listClients(...a),
  deleteClient: (...a: unknown[]) => deleteClient(...a),
}));
vi.mock("@/lib/api/configurableLists", () => ({ getConfigurableList: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/api/users", () => ({ listUsers: vi.fn().mockResolvedValue([]) }));
// Identités stables comme dans le vrai AuthContext (useCallback).
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
const hasPermission = (k: string) => permissions.includes(k);
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch, hasPermission }) }));

function client(id: string, firstName: string): ClientListItemDTO {
  const st = { id: "x", key: "K", label: "Statut", color: "#111" };
  return { id, firstName, lastName: "Test", phoneNumber: `+33${id}`, dossierStatus: st, finalStatus: st, agent: null, telephoniste: null } as unknown as ClientListItemDTO;
}
const A = client("1", "Alice");
const B = client("2", "Bruno");
const BACKEND_409 = "Ce dossier a un historique d'e-mails et ne peut pas être supprimé : la trace des envois doit être conservée.";

const rowOf = async (name: string) => (await screen.findByText(new RegExp(name))).closest("tr")!;
const openDeleteFor = async (name: string) => fireEvent.click(within(await rowOf(name)).getByRole("button", { name: "Supprimer" }));
const confirm = () =>
  fireEvent.click(within(screen.getByText("Supprimer ce dossier").closest("div.rounded-lg") as HTMLElement).getByRole("button", { name: "Supprimer" }));

describe("/clients — suppression d'un dossier", () => {
  beforeEach(() => {
    listClients.mockReset();
    deleteClient.mockReset();
    permissions = ["clients.view", "clients.delete"];
    listClients.mockResolvedValue({ items: [A, B], total: 2 });
  });

  it("sans clients.delete : aucun bouton Supprimer (Ouvrir reste)", async () => {
    permissions = ["clients.view"];
    render(<ClientsPage />);
    await screen.findByText(/Alice/);
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ouvrir" })).toHaveLength(2);
  });

  it("avec clients.delete : un bouton par ligne ; confirmation avec irréversibilité ; Annuler ne supprime rien", async () => {
    render(<ClientsPage />);
    await screen.findByText(/Alice/);
    expect(screen.getAllByRole("button", { name: "Supprimer" })).toHaveLength(2);
    await openDeleteFor("Alice");
    expect(screen.getByText(/irréversible/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(deleteClient).not.toHaveBeenCalled();
    expect(screen.queryByText("Supprimer ce dossier")).not.toBeInTheDocument();
  });

  it("succès (204) : deleteClient(id), modale fermée, le dossier disparaît de la liste", async () => {
    deleteClient.mockResolvedValue(undefined);
    render(<ClientsPage />);
    await openDeleteFor("Alice");
    listClients.mockResolvedValue({ items: [B], total: 1 });
    confirm();
    await waitFor(() => expect(deleteClient).toHaveBeenCalledWith("1", "tok"));
    await waitFor(() => expect(screen.queryByText(/Alice/)).not.toBeInTheDocument());
    expect(screen.getByText(/Bruno/)).toBeInTheDocument();
    expect(screen.queryByText("Supprimer ce dossier")).not.toBeInTheDocument();
  });

  it("409 (historique d'e-mails) : message backend tel quel, AUCUNE action de réessai proposée, dossier toujours présent après Fermer", async () => {
    deleteClient.mockRejectedValue(new ApiError(409, BACKEND_409, { code: "CLIENT_HAS_EMAIL_HISTORY" }));
    render(<ClientsPage />);
    await openDeleteFor("Alice");
    confirm();

    expect(await screen.findByText(BACKEND_409)).toBeInTheDocument();
    expect(screen.getByText("Suppression impossible")).toBeInTheDocument();
    expect(screen.queryByText("Supprimer ce dossier")).not.toBeInTheDocument();
    const dialog = screen.getByText("Suppression impossible").closest("div.rounded-lg") as HTMLElement;
    expect(within(dialog).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByText("Fermer"));

    expect(screen.queryByText(BACKEND_409)).not.toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("autre échec (403) : message générique, confirmation toujours possible, dossier présent", async () => {
    deleteClient.mockRejectedValue(new ApiError(403, "Accès refusé"));
    render(<ClientsPage />);
    await openDeleteFor("Bruno");
    confirm();
    expect(await screen.findByText("Impossible de supprimer ce dossier.")).toBeInTheDocument();
    expect(screen.queryByText("Accès refusé")).not.toBeInTheDocument();
    expect(screen.getByText("Supprimer ce dossier")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByText(/Bruno/)).toBeInTheDocument();
  });

  it("dernière ligne de la page 2 supprimée : retour à la page 1", async () => {
    listClients.mockResolvedValue({ items: [A], total: 26 });
    deleteClient.mockResolvedValue(undefined);
    render(<ClientsPage />);
    await screen.findByText(/Alice/);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await waitFor(() => expect(listClients.mock.calls.at(-1)![0].page).toBe(2));
    await openDeleteFor("Alice");
    confirm();
    await waitFor(() => expect(listClients.mock.calls.at(-1)![0].page).toBe(1));
  });
});
