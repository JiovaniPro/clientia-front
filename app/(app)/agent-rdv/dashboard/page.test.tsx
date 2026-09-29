import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentRdvDashboardPage from "./page";

const getSignedContractsCount = vi.fn();
const getAppointmentsReport = vi.fn();
vi.mock("@/lib/api/reports", () => ({
  getSignedContractsCount: (...a: unknown[]) => getSignedContractsCount(...a),
  getAppointmentsReport: (...a: unknown[]) => getAppointmentsReport(...a),
}));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch, user: { id: "agent-rdv-1" } }) }));

let listEventsCalls: unknown[][] = [];
vi.mock("@/lib/api/calendar", () => ({
  listEvents: (...args: unknown[]) => {
    listEventsCalls.push(args);
    return Promise.resolve([]);
  },
}));

let listClientsCalls: unknown[][] = [];
vi.mock("@/lib/api/clients", () => ({
  listClients: (...args: unknown[]) => {
    listClientsCalls.push(args);
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
  },
}));

const getConfigurableList = vi.fn();
vi.mock("@/lib/api/configurableLists", () => ({ getConfigurableList: (...a: unknown[]) => getConfigurableList(...a) }));

const CLIENT_FINAL_STATUS_ITEMS = [
  { id: "f1", listKey: "CLIENT_FINAL_STATUS", key: "EN_ATTENTE", label: "En attente", color: "#111", order: 0, isActive: true, isDefault: true, metadata: null },
  { id: "f2", listKey: "CLIENT_FINAL_STATUS", key: "DOSSIER_VALIDE", label: "Dossier validé", color: "#16A34A", order: 1, isActive: true, isDefault: false, metadata: { countsAsSignedContract: true } },
];

function appointmentsWith(statuses: string[]) {
  const byStatus = Object.entries(
    statuses.reduce((acc: Record<string, number>, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {}),
  ).map(([status, count]) => ({ status, count }));
  return { total: statuses.length, byStatus };
}

describe("/agent-rdv/dashboard — cartes RDV", () => {
  beforeEach(() => {
    listEventsCalls = [];
    listClientsCalls = [];
    getConfigurableList.mockReset();
    getConfigurableList.mockResolvedValue(CLIENT_FINAL_STATUS_ITEMS);
    getSignedContractsCount.mockResolvedValue({ count: 2 });
    // ordre d'appel dans fetchAll : signed, thisMonthAppointments, next7Days (upcoming), last30Days
    getAppointmentsReport
      .mockResolvedValueOnce(appointmentsWith(["REFUSE", "REFUSE"])) // thisMonthAppointments
      .mockResolvedValueOnce(appointmentsWith(["CONFIRME", "EN_ATTENTE_DE_CONFIRMATION"])) // next7Days
      .mockResolvedValueOnce(appointmentsWith([])); // last30Days
  });

  it("« RDV à venir (7 jours) » : bouton, ouvre la modale avec agentRdvId = l'agent connecté et le filtre des statuts actifs", async () => {
    render(<AgentRdvDashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: /RDV à venir \(7 jours\)/ }));

    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-rdv-1" });
    // Titre de la modale = libellé de la carte ; distinct de la carte source, encore affichée derrière.
    expect(screen.getByRole("heading", { name: "RDV à venir (7 jours)" })).toBeInTheDocument();
  });

  it("« Refusés (ce mois) » : bouton, ouvre la modale avec agentRdvId = l'agent connecté", async () => {
    render(<AgentRdvDashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Refusés \(ce mois\)/ }));

    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-rdv-1" });
  });

  it("« Contrats signés (ce mois) » : count > 0, bouton ; le clic résout le statut « signé » via CLIENT_FINAL_STATUS puis ouvre GET /clients avec updatedFrom/updatedTo + finalStatusKey + agentId = l'agent connecté", async () => {
    render(<AgentRdvDashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Contrats signés/ }));

    expect(getConfigurableList).toHaveBeenCalledWith("CLIENT_FINAL_STATUS", "tok");
    await waitFor(() => expect(listClientsCalls).toHaveLength(1));
    expect(listClientsCalls[0]![0]).toMatchObject({ finalStatusKey: "DOSSIER_VALIDE", agentId: "agent-rdv-1" });
    expect(listClientsCalls[0]![0]).toHaveProperty("updatedFrom");
    expect(listClientsCalls[0]![0]).toHaveProperty("updatedTo");
    expect(listClientsCalls[0]![0]).not.toHaveProperty("createdFrom");
  });

  it("count = 0 : la carte n'est pas cliquable, aucun appel à CLIENT_FINAL_STATUS", async () => {
    getSignedContractsCount.mockResolvedValue({ count: 0 });
    render(<AgentRdvDashboardPage />);
    await screen.findByText("Contrats signés (ce mois)");
    expect(screen.queryByRole("button", { name: /Contrats signés/ })).not.toBeInTheDocument();
    expect(getConfigurableList).not.toHaveBeenCalled();
  });
});
