import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallDTO } from "@/lib/api/calls";
import TodayPage from "./page";

const listCalls = vi.fn();
vi.mock("@/lib/api/calls", () => ({ listCalls: (...args: unknown[]) => listCalls(...args) }));
vi.mock("@/lib/api/configurableLists", () => ({
  getConfigurableList: vi.fn().mockResolvedValue([
    { id: "s1", key: "A_CONTACTER", label: "À contacter", color: "#111111", isDefault: true },
    { id: "s2", key: "RAPPEL", label: "À rappeler", color: "#D97706", isDefault: false },
  ]),
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { firstName: "Alix", email: "a@b.c" },
    authedFetch: (fn: (token: string) => unknown) => Promise.resolve(fn("tok")),
  }),
}));

function call(over: Partial<CallDTO>): CallDTO {
  return {
    id: "c1", firstName: "Maria", lastName: "Abazi", toNumber: "+33612345678",
    status: { id: "s2", key: "RAPPEL", label: "À rappeler", color: "#D97706" },
    lastStatusChangedAt: new Date(2026, 8, 21, 14, 5).toISOString(),
    occurredAt: new Date(2026, 8, 1, 9, 0).toISOString(), hasActiveReminder: false,
    ...over,
  } as unknown as CallDTO;
}

describe("Écran Aujourd'hui (§5.4)", () => {
  beforeEach(() => {
    listCalls.mockReset();
    listCalls.mockResolvedValue({ items: [call({}), call({ id: "c2", firstName: null, lastName: null, hasActiveReminder: true })], total: 2 });
  });

  it("filtre sur lastStatusChangedAt (changedFrom/changedTo), jamais from/to ni userId, tri 'changed'", async () => {
    render(<TodayPage />);
    await waitFor(() => expect(listCalls).toHaveBeenCalled());
    const filters = listCalls.mock.calls[0]![0];
    expect(filters.changedFrom).toBeDefined();
    expect(filters.changedTo).toBeDefined();
    expect(new Date(filters.changedFrom).getHours()).toBe(0);
    expect(filters).not.toHaveProperty("from");
    expect(filters).not.toHaveProperty("to");
    expect(filters).not.toHaveProperty("userId");
    expect(filters.sort).toBe("changed");
  });

  it("affiche l'heure de lastStatusChangedAt (pas occurredAt), la pastille de statut et l'icône de rappel seulement si hasActiveReminder", async () => {
    render(<TodayPage />);
    expect(await screen.findByText("Maria Abazi")).toBeInTheDocument();
    expect(screen.getAllByText("14:05")).toHaveLength(2);
    expect(screen.queryByText("09:00")).not.toBeInTheDocument();
    expect(screen.getAllByText("À rappeler").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: "Rappel programmé" })).toHaveLength(1);
  });

  const last = () => listCalls.mock.calls.at(-1)![0];

  it("multi-statut : 2 statuts -> statusKeys (union, jamais statusKey), retrait par puce, vidage = plus de filtre, retour page 1", async () => {
    listCalls.mockResolvedValue({ items: [call({})], total: 60 });
    render(<TodayPage />);
    await screen.findByText("Maria Abazi");
    expect(last()).not.toHaveProperty("statusKeys");

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await waitFor(() => expect(last().page).toBe(2));

    fireEvent.click(screen.getByLabelText("À contacter"));
    await waitFor(() => expect(last()).toMatchObject({ statusKeys: "A_CONTACTER", page: 1 }));
    fireEvent.click(screen.getByLabelText("À rappeler"));
    await waitFor(() => expect(last()).toMatchObject({ statusKeys: "A_CONTACTER,RAPPEL", page: 1 }));
    expect(last()).not.toHaveProperty("statusKey");
    expect(screen.getByText("2 statuts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retirer le statut À contacter" }));
    await waitFor(() => expect(last().statusKeys).toBe("RAPPEL"));
    expect(screen.queryByRole("button", { name: "Retirer le statut À contacter" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retirer le statut À rappeler" }));
    await waitFor(() => expect(last()).not.toHaveProperty("statusKeys"));
    expect(last()).not.toHaveProperty("statusKey");
    expect(screen.getByText("Tous les statuts")).toBeInTheDocument();
  });
});
