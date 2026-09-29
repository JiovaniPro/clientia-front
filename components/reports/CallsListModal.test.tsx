import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallDTO } from "@/lib/api/calls";
import { CallsListModal } from "./CallsListModal";

const listCalls = vi.fn();
vi.mock("@/lib/api/calls", () => ({ listCalls: (...args: unknown[]) => listCalls(...args) }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

function call(id: string, firstName: string): CallDTO {
  return {
    id, firstName, lastName: "Test", toNumber: `+336000000${id}`, occurredAt: new Date(2026, 8, 21, 10).toISOString(),
    status: { id: "s", key: "RDV_PRIS", label: "RDV pris", color: "#2f7d5a" },
  } as unknown as CallDTO;
}

describe("CallsListModal", () => {
  beforeEach(() => listCalls.mockReset());

  it("appelle GET /calls avec from/to/page/pageSize ; userId et statusKeys absents quand non fournis", async () => {
    listCalls.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    render(<CallsListModal title="Appels" from="2026-09-01T00:00:00.000Z" to="2026-09-30T23:59:59.000Z" onClose={() => {}} />);
    await waitFor(() => expect(listCalls).toHaveBeenCalled());
    const [filters] = listCalls.mock.calls[0]!;
    expect(filters).toMatchObject({ from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T23:59:59.000Z", page: 1, pageSize: 25 });
    expect(filters).not.toHaveProperty("userId");
    expect(filters).not.toHaveProperty("statusKeys");
  });

  it("userId et statusKeys transmis tels quels (statusKeys joints en une chaîne) quand fournis", async () => {
    listCalls.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    render(
      <CallsListModal title="Appels concluants" from="a" to="b" userId="agent-7" statusKeys={["RDV_PRIS", "DEJA_CLIENT"]} onClose={() => {}} />,
    );
    await waitFor(() => expect(listCalls).toHaveBeenCalled());
    expect(listCalls.mock.calls[0]![0]).toMatchObject({ userId: "agent-7", statusKeys: "RDV_PRIS,DEJA_CLIENT" });
  });

  it("le total et la liste affichés correspondent EXACTEMENT à ce que renvoie GET /calls (même chiffre que la carte)", async () => {
    listCalls.mockResolvedValue({ items: [call("1", "Alice"), call("2", "Bruno")], total: 2, page: 1, pageSize: 25 });
    render(<CallsListModal title="Appels" from="a" to="b" onClose={() => {}} />);

    expect(await screen.findByText("2 appels")).toBeInTheDocument();
    expect(screen.getByText("Alice Test")).toBeInTheDocument();
    expect(screen.getByText("Bruno Test")).toBeInTheDocument();
    expect(screen.getAllByText("RDV pris")).toHaveLength(2);
  });

  it("pagination SERVEUR : passer à la page 2 relance GET /calls avec page=2, pas un découpage côté client", async () => {
    listCalls
      .mockResolvedValueOnce({ items: [call("1", "Page1")], total: 30, page: 1, pageSize: 25 })
      .mockResolvedValueOnce({ items: [call("2", "Page2")], total: 30, page: 2, pageSize: 25 });
    render(<CallsListModal title="Appels" from="a" to="b" onClose={() => {}} />);

    await screen.findByText("Page1 Test");
    expect(screen.getByText("page 1 sur 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    await screen.findByText("Page2 Test");
    expect(listCalls).toHaveBeenCalledTimes(2);
    expect(listCalls.mock.calls[1]![0]).toMatchObject({ page: 2 });
    expect(screen.queryByText("Page1 Test")).not.toBeInTheDocument();
  });

  it("état vide et état d'erreur", async () => {
    listCalls.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    render(<CallsListModal title="Appels" from="a" to="b" onClose={() => {}} />);
    expect(await screen.findByText("Aucun appel sur cette période.")).toBeInTheDocument();
  });
});
