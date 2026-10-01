import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { CallDTO } from "@/lib/api/calls";
import CallsPage from "./page";

const listCalls = vi.fn();
const deleteCall = vi.fn();
const reassignCall = vi.fn();
const reassignCalls = vi.fn();
let permissions: string[] = [];

vi.mock("@/lib/api/calls", () => ({
  listCalls: (...a: unknown[]) => listCalls(...a),
  deleteCall: (...a: unknown[]) => deleteCall(...a),
  reassignCall: (...a: unknown[]) => reassignCall(...a),
  reassignCalls: (...a: unknown[]) => reassignCalls(...a),
}));
vi.mock("@/lib/api/users", () => ({
  listUsers: vi.fn().mockResolvedValue([
    { id: "agent-a", firstName: "Ana", lastName: "Calliste", email: "a@x", isActive: true, role: { id: "r", name: "Agent calliste" } },
    { id: "agent-b", firstName: "Ben", lastName: "Calliste", email: "b@x", isActive: true, role: { id: "r", name: "Agent calliste" } },
  ]),
}));
vi.mock("@/lib/api/configurableLists", () => ({
  getConfigurableList: vi.fn().mockResolvedValue([{ id: "s1", key: "A_CONTACTER", label: "À contacter", color: "#111", isDefault: true }]),
}));
// Identités stables comme dans le vrai AuthContext (useCallback) : sinon le fetch de la page se relance à chaque rendu.
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
const hasPermission = (k: string) => permissions.includes(k);
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch, hasPermission }) }));
vi.mock("@/components/calls/QualifyCallModal", () => ({ QualifyCallModal: () => null }));
vi.mock("@/components/calls/NewCallModal", () => ({ NewCallModal: () => null }));
vi.mock("@/components/calls/ImportCallsModal", () => ({ ImportCallsModal: () => null }));

function call(id: string, firstName: string): CallDTO {
  return {
    id, firstName, lastName: "Test", toNumber: `+33${id}`, type: "PROSPECTION", waveNumber: 1,
    userId: "admin-1", user: { id: "admin-1", firstName: "Admin", lastName: "Import" },
    status: { id: "s1", key: "A_CONTACTER", label: "À contacter", color: "#111" },
    occurredAt: new Date(2026, 8, 21, 10, 0).toISOString(),
  } as unknown as CallDTO;
}
const A = call("1", "Alice");
const B = call("2", "Bruno");

const BACKEND_409 = "Cet appel a un dossier client lié : supprimez d'abord le dossier client, puis l'appel.";
const openDeleteFor = async (name: string) => {
  const row = (await screen.findByText(new RegExp(name))).closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: "Supprimer" }));
};

describe("/calls — suppression d'un appel", () => {
  beforeEach(() => {
    listCalls.mockReset();
    deleteCall.mockReset();
    permissions = ["calls.view", "calls.delete"];
    listCalls.mockResolvedValue({ items: [A, B], total: 2 });
  });

  it("sans calls.delete : aucun bouton Supprimer (Qualifier reste)", async () => {
    permissions = ["calls.view"];
    render(<CallsPage />);
    await screen.findByText(/Alice/);
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Qualifier" })).toHaveLength(2);
  });

  it("avec calls.delete : un bouton Supprimer par ligne ; confirmation danger + irréversibilité ; Annuler ne supprime rien", async () => {
    render(<CallsPage />);
    await screen.findByText(/Alice/);
    expect(screen.getAllByRole("button", { name: "Supprimer" })).toHaveLength(2);

    await openDeleteFor("Alice");
    expect(screen.getByText("Supprimer cet appel")).toBeInTheDocument();
    expect(screen.getByText(/irréversible/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(deleteCall).not.toHaveBeenCalled();
    expect(screen.queryByText("Supprimer cet appel")).not.toBeInTheDocument();
  });

  it("succès (204) : deleteCall(id), modale fermée, l'appel disparaît de la liste", async () => {
    deleteCall.mockResolvedValue(undefined);
    render(<CallsPage />);
    await openDeleteFor("Alice");
    listCalls.mockResolvedValue({ items: [B], total: 1 });

    fireEvent.click(within(screen.getByText("Supprimer cet appel").closest("div.rounded-lg")! as HTMLElement).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(deleteCall).toHaveBeenCalledWith("1", "tok"));
    await waitFor(() => expect(screen.queryByText(/Alice/)).not.toBeInTheDocument());
    expect(screen.getByText(/Bruno/)).toBeInTheDocument();
    expect(screen.queryByText("Supprimer cet appel")).not.toBeInTheDocument();
  });

  it("409 CALL_HAS_CLIENT_DOSSIER : message backend affiché TEL QUEL, appel toujours présent après fermeture, aucun lien ajouté", async () => {
    deleteCall.mockRejectedValue(new ApiError(409, BACKEND_409, { code: "CALL_HAS_CLIENT_DOSSIER" }));
    render(<CallsPage />);
    await openDeleteFor("Alice");

    fireEvent.click(within(screen.getByText("Supprimer cet appel").closest("div.rounded-lg")! as HTMLElement).getByRole("button", { name: "Supprimer" }));

    expect(await screen.findByText(BACKEND_409)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByText(BACKEND_409)).not.toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("autre échec (403) : message générique dans la modale, pas le message backend ; l'appel reste", async () => {
    deleteCall.mockRejectedValue(new ApiError(403, "Accès refusé"));
    render(<CallsPage />);
    await openDeleteFor("Bruno");

    fireEvent.click(within(screen.getByText("Supprimer cet appel").closest("div.rounded-lg")! as HTMLElement).getByRole("button", { name: "Supprimer" }));

    expect(await screen.findByText("Impossible de supprimer cet appel.")).toBeInTheDocument();
    expect(screen.queryByText("Accès refusé")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByText(/Bruno/)).toBeInTheDocument();
  });

  it("dernière ligne de la page 2 supprimée : retour à la page 1", async () => {
    listCalls.mockResolvedValue({ items: [A], total: 26 });
    deleteCall.mockResolvedValue(undefined);
    render(<CallsPage />);
    await screen.findByText(/Alice/);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await waitFor(() => expect(listCalls.mock.calls.at(-1)![0].page).toBe(2));

    await openDeleteFor("Alice");
    fireEvent.click(within(screen.getByText("Supprimer cet appel").closest("div.rounded-lg")! as HTMLElement).getByRole("button", { name: "Supprimer" }));

    await waitFor(() => expect(listCalls.mock.calls.at(-1)![0].page).toBe(1));
  });
});

describe("/calls — attribution d'un appel par l'admin", () => {
  beforeEach(() => {
    listCalls.mockReset();
    reassignCall.mockReset();
    reassignCalls.mockReset();
    listCalls.mockResolvedValue({ items: [A, B], total: 2 });
  });

  it("sans calls.viewAll : ni colonne Agent ni cases à cocher", async () => {
    permissions = ["calls.view"];
    render(<CallsPage />);
    await screen.findByText(/Alice/);
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("sélecteur par ligne : propriétaire actuel affiché (admin importateur), choisir un agent réattribue cet appel", async () => {
    permissions = ["calls.view", "calls.viewAll"];
    reassignCall.mockResolvedValue({ count: 1, userId: "agent-b" });
    render(<CallsPage />);
    const select = await screen.findByLabelText("Agent de l'appel +331");
    await waitFor(() => expect(within(select).getByRole("option", { name: "Ben Calliste" })).toBeInTheDocument());
    expect(select).toHaveValue("admin-1");
    expect(within(select).getByRole("option", { name: "Admin Import" })).toBeDisabled();

    fireEvent.change(select, { target: { value: "agent-b" } });

    await waitFor(() => expect(reassignCall).toHaveBeenCalledWith("1", "agent-b", "tok"));
    expect(await screen.findByText("1 appel attribué à Ben Calliste.")).toBeInTheDocument();
    expect(listCalls).toHaveBeenCalledTimes(2); // liste rechargée
  });

  it("sélection multiple : « Tout sélectionner » puis « Attribuer à… » réattribue tout d'un coup", async () => {
    permissions = ["calls.view", "calls.viewAll"];
    reassignCalls.mockResolvedValue({ count: 2, userId: "agent-a" });
    render(<CallsPage />);
    await screen.findByText(/Alice/);

    fireEvent.click(screen.getByLabelText("Tout sélectionner sur cette page"));
    expect(screen.getByText("2 appels sélectionnés")).toBeInTheDocument();
    const attribuer = screen.getByRole("button", { name: "Attribuer" });
    expect(attribuer).toBeDisabled(); // aucun agent choisi
    await waitFor(() => expect(screen.getAllByRole("option", { name: "Ana Calliste" }).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Attribuer à"), { target: { value: "agent-a" } });
    fireEvent.click(attribuer);

    await waitFor(() => expect(reassignCalls).toHaveBeenCalledWith(["1", "2"], "agent-a", "tok"));
    expect(await screen.findByText("2 appels attribués à Ana Calliste.")).toBeInTheDocument();
    expect(screen.queryByText("2 appels sélectionnés")).not.toBeInTheDocument();
  });
});
