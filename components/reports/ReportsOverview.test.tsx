import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsOverview } from "./ReportsOverview";

const getCallsReport = vi.fn();
const getClientsReport = vi.fn();
const getAppointmentsReport = vi.fn();
vi.mock("@/lib/api/reports", () => ({
  getCallsReport: (...a: unknown[]) => getCallsReport(...a),
  getClientsReport: (...a: unknown[]) => getClientsReport(...a),
  getAppointmentsReport: (...a: unknown[]) => getAppointmentsReport(...a),
}));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

let listEventsCalls: unknown[][] = [];
vi.mock("@/lib/api/calendar", () => ({
  listEvents: (...args: unknown[]) => {
    listEventsCalls.push(args);
    return Promise.resolve([]);
  },
}));

let listCallsCalls: unknown[][] = [];
vi.mock("@/lib/api/calls", () => ({
  listCalls: (...args: unknown[]) => {
    listCallsCalls.push(args);
    return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
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

const CALL_STATUS_ITEMS = [
  { id: "s1", listKey: "CALL_STATUS", key: "A_CONTACTER", label: "À contacter", color: "#111", order: 0, isActive: true, isDefault: true, metadata: null },
  { id: "s2", listKey: "CALL_STATUS", key: "RDV_PRIS", label: "RDV pris", color: "#2f7d5a", order: 1, isActive: true, isDefault: false, metadata: { triggersClientDossierCreation: true } },
  { id: "s3", listKey: "CALL_STATUS", key: "DEJA_CLIENT", label: "Déjà client", color: "#2f7d5a", order: 2, isActive: true, isDefault: false, metadata: { triggersClientDossierCreation: true } },
  { id: "s4", listKey: "CALL_STATUS", key: "PAS_INTERESSE", label: "Pas intéressé", color: "#b3432f", order: 3, isActive: true, isDefault: false, metadata: null },
];

const EMPTY_CLIENTS = { total: 0, byDossierStatus: [], byFinalStatus: [] };
const CLIENTS_WITH_TOTAL = { total: 2, byDossierStatus: [], byFinalStatus: [] };
const CALLS_WITH_CONVERSION = {
  total: 3, byStatus: [], byType: [], byDirection: [], byUser: [],
  conversion: { triggeringCount: 5, rate: 0.33 },
};

describe("ReportsOverview — carte « Rendez-vous »", () => {
  beforeEach(() => {
    listEventsCalls = [];
    listCallsCalls = [];
    getConfigurableList.mockReset();
    getCallsReport.mockResolvedValue(CALLS_WITH_CONVERSION);
    getClientsReport.mockResolvedValue(CLIENTS_WITH_TOTAL);
  });

  it("total > 0 : la carte est un bouton, le clic ouvre la modale avec agentRdvId = userId reçu par ReportsOverview (my-stats)", async () => {
    getAppointmentsReport.mockResolvedValue({ total: 4, byStatus: [] });
    render(<ReportsOverview userId="agent-42" />);
    const card = await screen.findByRole("button", { name: /Rendez-vous/ });

    fireEvent.click(card);

    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-42" });
  });

  it("userId absent (/admin/dashboard, vue globale) : la modale ne reçoit PAS agentRdvId", async () => {
    getAppointmentsReport.mockResolvedValue({ total: 4, byStatus: [] });
    render(<ReportsOverview />);
    fireEvent.click(await screen.findByRole("button", { name: /Rendez-vous/ }));
    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).not.toHaveProperty("agentRdvId");
  });

  it("total = 0 : la carte n'est PAS cliquable (pas de bouton)", async () => {
    getAppointmentsReport.mockResolvedValue({ total: 0, byStatus: [] });
    render(<ReportsOverview />);
    await screen.findByText("Rendez-vous");
    expect(screen.queryByRole("button", { name: /Rendez-vous/ })).not.toBeInTheDocument();
  });

});

describe("ReportsOverview — carte « Nouveaux dossiers »", () => {
  beforeEach(() => {
    listClientsCalls = [];
    getConfigurableList.mockReset();
    getCallsReport.mockResolvedValue(CALLS_WITH_CONVERSION);
    getAppointmentsReport.mockResolvedValue({ total: 0, byStatus: [] });
  });

  it("total > 0 : bouton, le clic ouvre GET /clients avec createdFrom/createdTo + agentId = userId reçu par ReportsOverview (my-stats)", async () => {
    getClientsReport.mockResolvedValue(CLIENTS_WITH_TOTAL);
    render(<ReportsOverview userId="agent-42" />);
    fireEvent.click(await screen.findByRole("button", { name: /Nouveaux dossiers/ }));

    await waitFor(() => expect(listClientsCalls).toHaveLength(1));
    expect(listClientsCalls[0]![0]).toMatchObject({ agentId: "agent-42" });
    expect(listClientsCalls[0]![0]).toHaveProperty("createdFrom");
    expect(listClientsCalls[0]![0]).toHaveProperty("createdTo");
    expect(listClientsCalls[0]![0]).not.toHaveProperty("updatedFrom");
    expect(await screen.findByRole("heading", { name: /^Nouveaux dossiers —/ })).toBeInTheDocument();
  });

  it("userId absent : GET /clients sans agentId (vue globale)", async () => {
    getClientsReport.mockResolvedValue(CLIENTS_WITH_TOTAL);
    render(<ReportsOverview />);
    fireEvent.click(await screen.findByRole("button", { name: /Nouveaux dossiers/ }));
    await waitFor(() => expect(listClientsCalls).toHaveLength(1));
    expect(listClientsCalls[0]![0]).not.toHaveProperty("agentId");
  });

  it("total = 0 : la carte n'est pas cliquable", async () => {
    getClientsReport.mockResolvedValue(EMPTY_CLIENTS);
    render(<ReportsOverview />);
    await screen.findByText("Nouveaux dossiers");
    expect(screen.queryByRole("button", { name: /Nouveaux dossiers/ })).not.toBeInTheDocument();
  });
});

describe("ReportsOverview — carte « Appels »", () => {
  beforeEach(() => {
    listCallsCalls = [];
    getConfigurableList.mockReset();
    getCallsReport.mockResolvedValue(CALLS_WITH_CONVERSION);
    getClientsReport.mockResolvedValue(EMPTY_CLIENTS);
    getAppointmentsReport.mockResolvedValue({ total: 0, byStatus: [] });
  });

  it("total > 0 : bouton, le clic ouvre GET /calls avec from/to + userId = celui reçu par ReportsOverview, SANS statusKeys (total = tous statuts)", async () => {
    render(<ReportsOverview userId="agent-42" />);
    fireEvent.click(await screen.findByRole("button", { name: /^Appels/ }));

    await waitFor(() => expect(listCallsCalls).toHaveLength(1));
    expect(listCallsCalls[0]![0]).toMatchObject({ userId: "agent-42", page: 1, pageSize: 25 });
    expect(listCallsCalls[0]![0]).not.toHaveProperty("statusKeys");
    expect(await screen.findByRole("heading", { name: /^Appels —/ })).toBeInTheDocument();
  });

  it("userId absent : GET /calls sans userId (vue globale, comme calls.viewAll côté backend)", async () => {
    render(<ReportsOverview />);
    fireEvent.click(await screen.findByRole("button", { name: /^Appels/ }));
    await waitFor(() => expect(listCallsCalls).toHaveLength(1));
    expect(listCallsCalls[0]![0]).not.toHaveProperty("userId");
  });

  it("total = 0 : la carte n'est pas cliquable", async () => {
    getCallsReport.mockResolvedValue({ ...CALLS_WITH_CONVERSION, total: 0 });
    render(<ReportsOverview />);
    await screen.findByText("Appels", { selector: "p" });
    expect(screen.queryByRole("button", { name: /^Appels/ })).not.toBeInTheDocument();
  });
});

describe("ReportsOverview — carte « Taux de conversion »", () => {
  beforeEach(() => {
    listCallsCalls = [];
    getConfigurableList.mockReset();
    getConfigurableList.mockResolvedValue(CALL_STATUS_ITEMS);
    getCallsReport.mockResolvedValue(CALLS_WITH_CONVERSION);
    getClientsReport.mockResolvedValue(EMPTY_CLIENTS);
    getAppointmentsReport.mockResolvedValue({ total: 0, byStatus: [] });
  });

  it("triggeringCount > 0 : bouton ; le clic résout les statuts déclenchants via CALL_STATUS puis appelle GET /calls avec statusKeys = ces clés uniquement", async () => {
    render(<ReportsOverview />);
    fireEvent.click(await screen.findByRole("button", { name: /Taux de conversion/ }));

    expect(await getConfigurableList).toHaveBeenCalledWith("CALL_STATUS", "tok");
    await waitFor(() => expect(listCallsCalls).toHaveLength(1));
    expect(listCallsCalls[0]![0]).toMatchObject({ statusKeys: "RDV_PRIS,DEJA_CLIENT" });
    const filters = listCallsCalls[0]![0] as { statusKeys: string };
    // Jamais le statut neutre ni un statut non déclenchant.
    expect(filters.statusKeys).not.toContain("A_CONTACTER");
    expect(filters.statusKeys).not.toContain("PAS_INTERESSE");
  });

  it("triggeringCount = 0 : la carte n'est pas cliquable, aucun appel à CALL_STATUS", async () => {
    getCallsReport.mockResolvedValue({ ...CALLS_WITH_CONVERSION, conversion: { triggeringCount: 0, rate: 0 } });
    render(<ReportsOverview />);
    await screen.findByText("Taux de conversion");
    expect(screen.queryByRole("button", { name: /Taux de conversion/ })).not.toBeInTheDocument();
    expect(getConfigurableList).not.toHaveBeenCalled();
  });
});
