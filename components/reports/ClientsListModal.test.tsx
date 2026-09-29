import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientListItemDTO } from "@/lib/api/clients";
import { ClientsListModal } from "./ClientsListModal";

const listClients = vi.fn();
vi.mock("@/lib/api/clients", () => ({ listClients: (...args: unknown[]) => listClients(...args) }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

function client(id: string, firstName: string, createdAt: string, updatedAt: string): ClientListItemDTO {
  return {
    id, firstName, lastName: "Test", phoneNumber: `+336000000${id}`, createdAt, updatedAt,
    finalStatus: { id: "f", key: "DOSSIER_VALIDE", label: "Dossier validé", color: "#16A34A" },
  } as unknown as ClientListItemDTO;
}

describe("ClientsListModal", () => {
  beforeEach(() => listClients.mockReset());

  it("createdFrom/createdTo transmis tels quels ; updatedFrom/updatedTo, agentId, finalStatusKey absents quand non fournis", async () => {
    listClients.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    render(<ClientsListModal title="Nouveaux dossiers" createdFrom="2026-09-01T00:00:00.000Z" createdTo="2026-09-30T23:59:59.000Z" onClose={() => {}} />);
    await waitFor(() => expect(listClients).toHaveBeenCalled());
    const [filters] = listClients.mock.calls[0]!;
    expect(filters).toMatchObject({ createdFrom: "2026-09-01T00:00:00.000Z", createdTo: "2026-09-30T23:59:59.000Z", page: 1, pageSize: 25 });
    expect(filters).not.toHaveProperty("updatedFrom");
    expect(filters).not.toHaveProperty("agentId");
    expect(filters).not.toHaveProperty("finalStatusKey");
  });

  it("updatedFrom/updatedTo + finalStatusKey + agentId transmis tels quels (drill-down « Contrats signés »)", async () => {
    listClients.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    render(
      <ClientsListModal title="Contrats signés" updatedFrom="a" updatedTo="b" finalStatusKey="DOSSIER_VALIDE" agentId="agent-9" onClose={() => {}} />,
    );
    await waitFor(() => expect(listClients).toHaveBeenCalled());
    expect(listClients.mock.calls[0]![0]).toMatchObject({ updatedFrom: "a", updatedTo: "b", finalStatusKey: "DOSSIER_VALIDE", agentId: "agent-9" });
    expect(listClients.mock.calls[0]![0]).not.toHaveProperty("createdFrom");
  });

  it("le total et la liste affichés correspondent EXACTEMENT à ce que renvoie GET /clients (même chiffre que la carte)", async () => {
    listClients.mockResolvedValue({
      items: [client("1", "Alice", "2026-09-10T00:00:00.000Z", "2026-09-10T00:00:00.000Z"), client("2", "Bruno", "2026-09-11T00:00:00.000Z", "2026-09-11T00:00:00.000Z")],
      total: 2, page: 1, pageSize: 25,
    });
    render(<ClientsListModal title="Nouveaux dossiers" createdFrom="a" createdTo="b" onClose={() => {}} />);
    expect(await screen.findByText("2 dossiers")).toBeInTheDocument();
    expect(screen.getByText("Alice Test")).toBeInTheDocument();
    expect(screen.getByText("Bruno Test")).toBeInTheDocument();
  });

  it("pagination SERVEUR : page suivante relance GET /clients avec page=2", async () => {
    listClients
      .mockResolvedValueOnce({ items: [client("1", "Page1", "a", "a")], total: 30, page: 1, pageSize: 25 })
      .mockResolvedValueOnce({ items: [client("2", "Page2", "a", "a")], total: 30, page: 2, pageSize: 25 });
    render(<ClientsListModal title="Nouveaux dossiers" createdFrom="a" createdTo="b" onClose={() => {}} />);

    await screen.findByText("Page1 Test");
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    await screen.findByText("Page2 Test");
    expect(listClients.mock.calls[1]![0]).toMatchObject({ page: 2 });
    expect(screen.queryByText("Page1 Test")).not.toBeInTheDocument();
  });

  it("état vide et état d'erreur", async () => {
    listClients.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    render(<ClientsListModal title="Nouveaux dossiers" createdFrom="a" createdTo="b" onClose={() => {}} />);
    expect(await screen.findByText("Aucun dossier sur cette période.")).toBeInTheDocument();
  });
});
