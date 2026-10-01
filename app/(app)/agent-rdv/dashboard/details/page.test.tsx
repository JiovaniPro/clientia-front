import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgentRdvDetailsPage from "./page";

/** Sous-lot 4 honoré/manqué — colonnes Honorés / Manqués / Non marqués du tableau « Détail du suivi ». */
vi.mock("@/lib/api/reports", () => ({
  getAppointmentsHistory: vi.fn(async () => ({
    granularity: "week",
    periods: [
      {
        from: "2099-01-01T00:00:00.000Z", to: "2099-01-08T00:00:00.000Z",
        totalAppointments: 9, confirmedCount: 6, refusedCount: 1,
        honoredCount: 3, missedCount: 2, unmarkedCount: 1,
        signedContracts: 1, conversionRate: 0.11,
      },
    ],
  })),
}));
const listEvents = vi.fn(async () => []);
vi.mock("@/lib/api/calendar", () => ({ listEvents: (...args: unknown[]) => listEvents(...(args as [])) }));
let permissions: string[] = [];
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    authedFetch,
    user: { id: "agent1" },
    hasPermission: (k: string) => permissions.includes(k),
  }),
}));

describe("/agent-rdv/dashboard/details — colonnes de présence", () => {
  it("affiche Honorés / Manqués / Non marqués par période, depuis getAppointmentsHistory", async () => {
    render(<AgentRdvDetailsPage />);
    const cell = await screen.findByText("9"); // RDV total : la ligne est chargée
    const row = cell.closest("tr")!;
    const headers = Array.from(row.closest("table")!.querySelectorAll("th")).map((h) => h.textContent);
    const values = Array.from(row.querySelectorAll("td")).map((c) => c.textContent);
    const valueOf = (header: string) => values[headers.indexOf(header)];

    expect(valueOf("Honorés")).toBe("3");
    expect(valueOf("Manqués")).toBe("2");
    expect(valueOf("Non marqués")).toBe("1");
  });
});

describe("/agent-rdv/dashboard/details — portée du détail (vue calendrier partagée)", () => {
  it.each([
    ["Agent RDV (sans reports.viewAll) : restreint à ses propres RDV", [], "agent1"],
    ["Admin (reports.viewAll) : toute l'organisation, comme les chiffres", ["reports.viewAll"], undefined],
  ])("%s", async (_label, perms, expectedAgent) => {
    permissions = perms;
    listEvents.mockClear();
    render(<AgentRdvDetailsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Voir le détail" }));
    await waitFor(() => expect(listEvents).toHaveBeenCalled());
    expect((listEvents.mock.calls[0] as unknown[])[0]).toMatchObject({ type: "APPOINTMENT" });
    expect(((listEvents.mock.calls[0] as unknown[])[0] as { agentRdvId?: string }).agentRdvId).toBe(expectedAgent);
  });
});
