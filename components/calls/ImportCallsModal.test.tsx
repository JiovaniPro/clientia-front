import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UserListItemDTO } from "@/lib/api/users";
import { ImportCallsModal } from "./ImportCallsModal";

/** Import admin : choix obligatoire de l'agent calliste qui reçoit les leads. */
const importCalls = vi.fn().mockResolvedValue({ waveNumber: 3, count: 2, userId: "a2" });
vi.mock("@/lib/api/calls", () => ({ importCalls: (...a: unknown[]) => importCalls(...a) }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

const agent = (id: string, firstName: string): UserListItemDTO => ({
  id, firstName, lastName: "Calliste", email: `${id}@x.fr`, isActive: true, createdAt: "", role: { id: "r", name: "Agent calliste" },
});
const file = new File(["Téléphone\n+33611111111"], "leads.csv", { type: "text/csv" });
const pickFile = (container: HTMLElement) =>
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

describe("ImportCallsModal", () => {
  it("admin : la liste des agents apparaît après le fichier, Importer bloqué tant qu'aucun agent n'est choisi", async () => {
    const { container } = render(<ImportCallsModal onClose={vi.fn()} onImported={vi.fn()} agents={[agent("a1", "Camille"), agent("a2", "Sam")]} />);
    expect(screen.queryByText("Attribuer les appels à")).toBeNull();
    pickFile(container);
    expect(screen.getByText("Attribuer les appels à")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importer" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Sam Calliste/));
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));

    expect(await screen.findByText(/dans la file de Sam Calliste/)).toBeInTheDocument();
    expect(importCalls).toHaveBeenCalledWith(file, "tok", "a2");
  });

  it("sans liste d'agents (calliste) : import direct, sans choix", async () => {
    importCalls.mockClear();
    const { container } = render(<ImportCallsModal onClose={vi.fn()} onImported={vi.fn()} />);
    pickFile(container);
    expect(screen.queryByText("Attribuer les appels à")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    await screen.findByText(/Vague V-3 créée/);
    expect(importCalls).toHaveBeenCalledWith(file, "tok", undefined);
  });
});
