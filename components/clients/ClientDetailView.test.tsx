import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ClientDetailDTO } from "@/lib/api/clients";
import { ClientDetailView } from "./ClientDetailView";

const push = vi.fn();
const getClient = vi.fn();
const deleteClient = vi.fn();
let permissions: string[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/api/clients", () => ({
  getClient: (...a: unknown[]) => getClient(...a),
  updateClient: vi.fn(),
  deleteClient: (...a: unknown[]) => deleteClient(...a),
}));
vi.mock("@/lib/api/configurableLists", () => ({ getConfigurableList: vi.fn().mockResolvedValue([]) }));
vi.mock("@/components/clients/SendEmailModal", () => ({ SendEmailModal: () => null }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ authedFetch, user: { id: "u1", permissions } }),
}));

const st = { id: "x", key: "K", label: "Statut", color: "#111" };
const CLIENT = {
  id: "c1", firstName: "Alice", lastName: "Test", phoneNumber: "+33600000001", email: null, agentId: "u1",
  dossierStatus: st, finalStatus: st, civilite: null, maritalStatus: null, children: null, typeRdv: null,
  country: { label: "France" }, adresse: null, comment: null, createdAt: new Date(2026, 8, 21).toISOString(),
  telephoniste: null, agent: null,
} as unknown as ClientDetailDTO;
const BACKEND_409 = "Ce dossier a un historique d'e-mails et ne peut pas être supprimé : la trace des envois doit être conservée.";

const openDialog = async () => fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
const confirm = () =>
  fireEvent.click(within(screen.getByText("Supprimer ce dossier").closest("div.rounded-lg") as HTMLElement).getByRole("button", { name: "Supprimer" }));

describe("fiche dossier — suppression", () => {
  beforeEach(() => {
    push.mockReset();
    deleteClient.mockReset();
    getClient.mockReset();
    getClient.mockResolvedValue(CLIENT);
    permissions = ["clients.view", "clients.delete", "emails.send"];
  });

  it("sans clients.delete : pas de bouton Supprimer ; avec : à côté de « Envoyer un e-mail », dans le même en-tête", async () => {
    permissions = ["clients.view", "emails.send"];
    const { unmount } = render(<ClientDetailView clientId="c1" />);
    await screen.findByRole("button", { name: "Envoyer un e-mail" });
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
    unmount();

    permissions = ["clients.view", "clients.delete", "emails.send"];
    render(<ClientDetailView clientId="c1" />);
    const del = await screen.findByRole("button", { name: "Supprimer" });
    expect(del.parentElement).toBe(screen.getByRole("button", { name: "Envoyer un e-mail" }).parentElement);
  });

  it("succès (204) : deleteClient(id) puis redirection vers /clients", async () => {
    deleteClient.mockResolvedValue(undefined);
    render(<ClientDetailView clientId="c1" />);
    await openDialog();
    expect(screen.getByText(/irréversible/)).toBeInTheDocument();
    confirm();
    await waitFor(() => expect(deleteClient).toHaveBeenCalledWith("c1", "tok"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clients"));
  });

  it("409 (historique d'e-mails) : message backend tel quel, pas de réessai, PAS de redirection, la fiche reste", async () => {
    deleteClient.mockRejectedValue(new ApiError(409, BACKEND_409, { code: "CLIENT_HAS_EMAIL_HISTORY" }));
    render(<ClientDetailView clientId="c1" />);
    await openDialog();
    confirm();

    expect(await screen.findByText(BACKEND_409)).toBeInTheDocument();
    const dialog = screen.getByText("Suppression impossible").closest("div.rounded-lg") as HTMLElement;
    expect(within(dialog).queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByText("Fermer"));

    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText(BACKEND_409)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alice Test" })).toBeInTheDocument();
  });

  it("autre échec (403) : message générique, pas de redirection", async () => {
    deleteClient.mockRejectedValue(new ApiError(403, "Accès refusé"));
    render(<ClientDetailView clientId="c1" />);
    await openDialog();
    confirm();
    expect(await screen.findByText("Impossible de supprimer ce dossier.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
