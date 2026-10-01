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
  total: 10, qualified: 3, byStatus: [], byType: [], byDirection: [], byUser: [],
  byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 10 ? 3 : 0 })),
  conversion: { triggeringCount: 5, rate: 0.33 },
};

beforeEach(() => {
  listCallsCalls = [];
  listClientsCalls = [];
  getConfigurableList.mockReset();
  getConfigurableList.mockResolvedValue(CALL_STATUS_ITEMS);
  getAppointmentsReport.mockReset();
  getCallsReport.mockResolvedValue(CALLS_WITH_CONVERSION);
  getClientsReport.mockResolvedValue(CLIENTS_WITH_TOTAL);
});

describe("ReportsOverview — disposition", () => {
  it("4 cartes ; graphique horaire + camembert « Appels par statut » ; plus de « Rendez-vous par statut » ni « Dossiers par statut final »", async () => {
    render(<ReportsOverview />);
    for (const label of ["Appels qualifiés", "Rendez-vous pris", "Nouveaux dossiers", "Taux de conversion"]) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Appels qualifiés par heure" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Appels par statut" })).toBeInTheDocument();
    expect(screen.queryByText("Rendez-vous par statut")).toBeNull();
    expect(screen.queryByText("Dossiers par statut final")).toBeNull();
    expect(screen.queryByText(/Appels par agent/)).toBeNull();
    // La carte RDV ne repose plus sur les événements calendrier.
    expect(getAppointmentsReport).not.toHaveBeenCalled();
  });
});

describe("ReportsOverview — carte « Appels qualifiés »", () => {
  it("chiffre principal = qualifiés ; total en sous-texte discret", async () => {
    render(<ReportsOverview />);
    const card = await screen.findByRole("button", { name: /^Appels qualifiés/ });
    expect(card.querySelector(".font-display")).toHaveTextContent(/^3$/);
    expect(card).toHaveTextContent("sur 10 appels de la période");
  });

  it("clic : GET /calls avec from/to + userId reçu, SANS statusKeys", async () => {
    render(<ReportsOverview userId="agent-42" />);
    fireEvent.click(await screen.findByRole("button", { name: /^Appels qualifiés/ }));
    await waitFor(() => expect(listCallsCalls).toHaveLength(1));
    expect(listCallsCalls[0]![0]).toMatchObject({ userId: "agent-42", page: 1, pageSize: 25 });
    expect(listCallsCalls[0]![0]).not.toHaveProperty("statusKeys");
    expect(await screen.findByRole("heading", { name: /^Appels —/ })).toBeInTheDocument();
  });

  it("userId absent : GET /calls sans userId (vue globale)", async () => {
    render(<ReportsOverview />);
    fireEvent.click(await screen.findByRole("button", { name: /^Appels qualifiés/ }));
    await waitFor(() => expect(listCallsCalls).toHaveLength(1));
    expect(listCallsCalls[0]![0]).not.toHaveProperty("userId");
  });

  it("aucun appel sur la période : la carte n'est pas cliquable", async () => {
    getCallsReport.mockResolvedValue({ ...CALLS_WITH_CONVERSION, total: 0, qualified: 0 });
    render(<ReportsOverview />);
    await screen.findByText("Appels qualifiés", { selector: "p" });
    expect(screen.queryByRole("button", { name: /^Appels qualifiés/ })).not.toBeInTheDocument();
  });
});

describe("ReportsOverview — carte « Rendez-vous pris »", () => {
  it("affiche les appels qualifiés au statut déclenchant (triggeringCount) ; le clic liste ces appels", async () => {
    render(<ReportsOverview userId="calliste-7" />);
    const card = await screen.findByRole("button", { name: /^Rendez-vous pris/ });
    expect(card.querySelector(".font-display")).toHaveTextContent(/^5$/);

    fireEvent.click(card);
    await waitFor(() => expect(listCallsCalls).toHaveLength(1));
    expect(listCallsCalls[0]![0]).toMatchObject({ userId: "calliste-7", statusKeys: "RDV_PRIS,DEJA_CLIENT" });
  });

  it("0 : pas cliquable", async () => {
    getCallsReport.mockResolvedValue({ ...CALLS_WITH_CONVERSION, conversion: { triggeringCount: 0, rate: 0 } });
    render(<ReportsOverview />);
    await screen.findByText("Rendez-vous pris");
    expect(screen.queryByRole("button", { name: /^Rendez-vous pris/ })).not.toBeInTheDocument();
  });
});

describe("ReportsOverview — carte « Nouveaux dossiers »", () => {
  it("le rapport reçoit le userId consulté (avant : jamais transmis) ; clic → GET /clients createdFrom/createdTo + agentId", async () => {
    render(<ReportsOverview userId="agent-42" />);
    await waitFor(() => expect(getClientsReport).toHaveBeenCalledWith(expect.objectContaining({ userId: "agent-42" }), "tok"));

    fireEvent.click(await screen.findByRole("button", { name: /Nouveaux dossiers/ }));
    await waitFor(() => expect(listClientsCalls).toHaveLength(1));
    expect(listClientsCalls[0]![0]).toMatchObject({ agentId: "agent-42" });
    expect(listClientsCalls[0]![0]).toHaveProperty("createdFrom");
    expect(listClientsCalls[0]![0]).not.toHaveProperty("updatedFrom");
    expect(await screen.findByRole("heading", { name: /^Nouveaux dossiers —/ })).toBeInTheDocument();
  });

  it("userId absent : GET /clients sans agentId (vue globale)", async () => {
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

describe("ReportsOverview — carte « Taux de conversion »", () => {
  it("triggeringCount > 0 : le clic résout les statuts déclenchants via CALL_STATUS puis GET /calls avec ces clés uniquement", async () => {
    render(<ReportsOverview />);
    fireEvent.click(await screen.findByRole("button", { name: /Taux de conversion/ }));

    expect(getConfigurableList).toHaveBeenCalledWith("CALL_STATUS", "tok");
    await waitFor(() => expect(listCallsCalls).toHaveLength(1));
    const filters = listCallsCalls[0]![0] as { statusKeys: string };
    expect(filters.statusKeys).toBe("RDV_PRIS,DEJA_CLIENT");
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
