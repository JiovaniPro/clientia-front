import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodoStrip } from "./TodoStrip";

const listCalls = vi.fn();
const listReminders = vi.fn();
let permissions: string[] = [];

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/api/calls", () => ({ listCalls: (...a: unknown[]) => listCalls(...a) }));
vi.mock("@/lib/api/reminders", () => ({ listReminders: (...a: unknown[]) => listReminders(...a) }));
vi.mock("@/lib/api/configurableLists", () => ({
  getConfigurableList: vi.fn().mockResolvedValue([{ id: "s1", key: "A_CONTACTER", isDefault: true }, { id: "s2", key: "RDV", isDefault: false }]),
}));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
const hasPermission = (k: string) => permissions.includes(k);
const user = { id: "me" };
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ user, authedFetch, hasPermission }) }));

const inMinutes = (m: number) => new Date(Date.now() + m * 60000).toISOString();

beforeEach(() => {
  permissions = ["calls.view", "reminders.view"];
  listCalls.mockReset();
  listReminders.mockReset();
  listCalls.mockResolvedValue({ items: [], total: 12, page: 1, pageSize: 1 });
  listReminders.mockResolvedValue([
    { id: "r1", userId: "me", dueAt: inMinutes(-90) }, // en retard
    { id: "r2", userId: "me", dueAt: inMinutes(-5) }, // en retard
    { id: "r3", userId: "someone-else", dueAt: inMinutes(-5) }, // rappel lié d'un autre agent : ignoré
  ]);
});

describe("TodoStrip — « À traiter »", () => {
  it("file scopée à soi sur le statut neutre ; rappels en retard comptés sur SES rappels ; liens vers les écrans", async () => {
    render(<TodoStrip />);
    const queue = await screen.findByRole("link", { name: /12\s*appels à passer/ });
    expect(queue).toHaveAttribute("href", "/calls");
    expect(listCalls).toHaveBeenCalledWith({ statusKey: "A_CONTACTER", userId: "me", page: 1, pageSize: 1 }, "tok");
    expect(listReminders).toHaveBeenCalledWith({ status: "PENDING", userId: "me" }, "tok");

    expect(screen.getByRole("link", { name: /2\s*rappels en retard/ })).toHaveAttribute("href", "/reminders");
    expect(screen.getByRole("link", { name: /0\s*rappel prévu aujourd'hui/ })).toBeInTheDocument();
  });

  it("sans permission rappels : seule la file ; échec de la file : rien ne casse", async () => {
    permissions = ["calls.view"];
    render(<TodoStrip />);
    expect(await screen.findByRole("link", { name: /appels à passer/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /rappel/ })).toBeNull();
    expect(listReminders).not.toHaveBeenCalled();
  });

  it("tout échoue : le bandeau ne s'affiche pas", async () => {
    listCalls.mockRejectedValue(new Error("boom"));
    listReminders.mockRejectedValue(new Error("boom"));
    const { container } = render(<TodoStrip />);
    await vi.waitFor(() => expect(listReminders).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
