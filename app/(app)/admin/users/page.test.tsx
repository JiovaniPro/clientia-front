import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage from "./page";

const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch, user: { id: "u-me" } }) }));
vi.mock("@/components/admin/UserFormModal", () => ({ UserFormModal: () => <div role="dialog">Formulaire utilisateur</div> }));

const listUsers = vi.fn();
const listDeletedUsers = vi.fn();
const setUserStatus = vi.fn();
vi.mock("@/lib/api/users", () => ({
  listUsers: (...a: unknown[]) => listUsers(...a),
  listDeletedUsers: (...a: unknown[]) => listDeletedUsers(...a),
  setUserStatus: (...a: unknown[]) => setUserStatus(...a),
  deleteUser: vi.fn(),
  purgeUser: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("@/lib/api/roles", () => ({
  listRoles: () =>
    Promise.resolve([
      { id: "r-admin", name: "Administrateur", description: null, color: "#1F6F54", isSystem: true },
      { id: "r-rdv", name: "Agent RDV", description: null, color: "#3B6E91", isSystem: true },
    ]),
}));

const user = (id: string, firstName: string, role: { id: string; name: string }, isActive = true) => ({
  id, firstName, lastName: "Test", email: `${firstName.toLowerCase()}@x.test`, isActive, createdAt: "2026-09-03T08:00:00Z", role,
});
const ADMIN = { id: "r-admin", name: "Administrateur" };
const RDV = { id: "r-rdv", name: "Agent RDV" };
const USERS = [user("u-me", "Alix", ADMIN), user("u2", "Robin", RDV), user("u3", "Zoé", RDV, false)];

beforeEach(() => {
  listUsers.mockReset().mockResolvedValue(USERS);
  listDeletedUsers.mockReset().mockResolvedValue([]);
  setUserStatus.mockReset();
});

describe("/admin/users", () => {
  it("chiffres en tête, une ligne par personne avec son rôle et l'état de son compte", async () => {
    render(<AdminUsersPage />);
    expect(await screen.findByText("Robin Test")).toBeInTheDocument();
    expect(screen.getByText("Comptes actifs").previousElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Comptes inactifs").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Vous")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Compte de Zoé Test" })).toHaveAttribute("aria-checked", "false");
  });

  it("son propre compte ne peut pas être désactivé", async () => {
    render(<AdminUsersPage />);
    expect(await screen.findByRole("switch", { name: "Compte de Alix Test" })).toBeDisabled();
  });

  it("recherche, filtre par rôle (puces avec compteurs) et par statut se combinent ; réinitialiser rend tout", async () => {
    render(<AdminUsersPage />);
    await screen.findByText("Robin Test");

    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher un utilisateur" }), { target: { value: "robin" } });
    expect(screen.queryByText("Alix Test")).toBeNull();
    expect(screen.getByText("Robin Test")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Rôle" })).getByRole("button", { name: /Agent RDV\s*2/ }));
    expect(screen.queryByText("Alix Test")).toBeNull();
    expect(screen.getByText("Zoé Test")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("group", { name: "Statut du compte" })).getByRole("button", { name: "Actifs" }));
    expect(screen.queryByText("Zoé Test")).toBeNull();
    expect(screen.getByText("Robin Test")).toBeInTheDocument();
  });

  it("désactiver passe par une confirmation ; réactiver est immédiat", async () => {
    setUserStatus.mockImplementation((id: string, isActive: boolean) => Promise.resolve({ ...USERS.find((u) => u.id === id)!, isActive }));
    render(<AdminUsersPage />);
    await screen.findByText("Robin Test");

    fireEvent.click(screen.getByRole("switch", { name: "Compte de Robin Test" }));
    expect(setUserStatus).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Désactiver" }));
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith("u2", false, "tok"));
    expect(await screen.findByRole("status")).toHaveTextContent("Robin Test désactivé.");

    fireEvent.click(screen.getByRole("switch", { name: "Compte de Zoé Test" }));
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith("u3", true, "tok"));
  });

  it("menu d'actions : suppression refusée tant que le compte est actif", async () => {
    render(<AdminUsersPage />);
    await screen.findByText("Robin Test");

    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions pour Robin Test" }));
    expect(screen.getByRole("menuitem", { name: "Supprimer le compte" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Plus d'actions pour Zoé Test" }));
    expect(screen.getByRole("menuitem", { name: "Supprimer le compte" })).toBeEnabled();
  });

  it("onglet Supprimés : liste vide expliquée", async () => {
    render(<AdminUsersPage />);
    await screen.findByText("Robin Test");
    fireEvent.click(screen.getByRole("button", { name: /Supprimés/ }));
    expect(await screen.findByText("Aucun utilisateur supprimé.")).toBeInTheDocument();
  });
});
