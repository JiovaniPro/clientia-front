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
let permissions = ["calendar.manageAppointments"];
// Référence stable (comme le useCallback réel) : sinon fetchAll changerait à chaque rendu.
const hasPermission = (key: string) => permissions.includes(key);
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch, hasPermission, user: { id: "agent-rdv-1" } }) }));

let listEventsCalls: unknown[][] = [];
let listEventsResult: unknown[] = [];
const getPendingAppointmentsCount = vi.fn();
vi.mock("@/lib/api/calendar", () => ({
  listEvents: (...args: unknown[]) => {
    listEventsCalls.push(args);
    return Promise.resolve(listEventsResult);
  },
  getPendingAppointmentsCount: (...a: unknown[]) => getPendingAppointmentsCount(...a),
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
  return { total: statuses.length, byStatus, attendance: { honored: 0, missed: 0, unmarked: 0 } };
}

describe("/agent-rdv/dashboard — cartes RDV", () => {
  beforeEach(() => {
    listEventsCalls = [];
    listEventsResult = [];
    listClientsCalls = [];
    getConfigurableList.mockReset();
    getConfigurableList.mockResolvedValue(CLIENT_FINAL_STATUS_ITEMS);
    getSignedContractsCount.mockResolvedValue({ count: 2 });
    permissions = ["calendar.manageAppointments"];
    getPendingAppointmentsCount.mockReset();
    getPendingAppointmentsCount.mockResolvedValue({ count: 0 });
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

describe("/agent-rdv/dashboard — bandeau RDV en attente de ma confirmation", () => {
  beforeEach(() => {
    getSignedContractsCount.mockResolvedValue({ count: 0 });
    getAppointmentsReport.mockReset();
    getAppointmentsReport.mockResolvedValue(appointmentsWith([]));
    permissions = ["calendar.manageAppointments"];
    getPendingAppointmentsCount.mockReset();
  });

  it("count > 0 : bandeau affiché avec le bon compte, lien vers /calendar-pro", async () => {
    getPendingAppointmentsCount.mockResolvedValue({ count: 3 });
    render(<AgentRdvDashboardPage />);

    const banner = await screen.findByRole("link", { name: /3 rendez-vous en attente de votre confirmation/ });
    expect(banner).toHaveAttribute("href", "/calendar-pro");
    expect(getPendingAppointmentsCount).toHaveBeenCalledWith("tok");
  });

  it("count = 0 : bandeau caché", async () => {
    getPendingAppointmentsCount.mockResolvedValue({ count: 0 });
    render(<AgentRdvDashboardPage />);

    await screen.findByText("Contrats signés (ce mois)");
    await waitFor(() => expect(getPendingAppointmentsCount).toHaveBeenCalled());
    expect(screen.queryByText(/en attente de votre confirmation/)).not.toBeInTheDocument();
  });

  it("sans calendar.manageAppointments : aucun appel, pas de bandeau", async () => {
    permissions = [];
    getPendingAppointmentsCount.mockResolvedValue({ count: 5 });
    render(<AgentRdvDashboardPage />);

    await screen.findByText("Contrats signés (ce mois)");
    expect(getPendingAppointmentsCount).not.toHaveBeenCalled();
    expect(screen.queryByText(/en attente de votre confirmation/)).not.toBeInTheDocument();
  });

  it("échec de l'appel : bandeau caché, le reste du dashboard s'affiche", async () => {
    getPendingAppointmentsCount.mockRejectedValue(new Error("boom"));
    render(<AgentRdvDashboardPage />);

    await screen.findByText("Contrats signés (ce mois)");
    expect(screen.queryByText(/en attente de votre confirmation/)).not.toBeInTheDocument();
    expect(screen.queryByText("Impossible de charger le tableau de bord.")).not.toBeInTheDocument();
  });
});

/**
 * Sous-lot 4 honoré/manqué — 4e KPI du brief. Correspondance exacte carte ↔ drill-down :
 * la liste renvoyée par GET /calendar-events contient des leurres (honoré, non marqué,
 * futur, refusé, et un manqué à cheval sur le début du mois, que le rapport ne compte pas
 * puisqu'il commence avant) ; la modale filtrée doit afficher exactement le chiffre de la carte.
 */
describe("/agent-rdv/dashboard — carte « RDV manqués (ce mois) »", () => {
  function appointmentAt(id: string, start: number, end: number, extra: Record<string, unknown>) {
    return { id, title: `RDV ${id}`, type: "APPOINTMENT", status: "CONFIRME", attended: null,
      startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), ...extra };
  }

  beforeEach(() => {
    listEventsCalls = [];
    getSignedContractsCount.mockResolvedValue({ count: 0 });
    getPendingAppointmentsCount.mockResolvedValue({ count: 0 });
    getAppointmentsReport.mockReset();
    getAppointmentsReport
      .mockResolvedValueOnce({ ...appointmentsWith(["CONFIRME", "CONFIRME"]), attendance: { honored: 1, missed: 2, unmarked: 1 } })
      .mockResolvedValue(appointmentsWith([]));

    // Instants relatifs à la plage réelle [début du mois, maintenant] : robustes quel que soit le jour.
    const now = Date.now();
    const d = new Date();
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const at = (f: number) => monthStart + f * (now - monthStart);
    const short = 0.02 * (now - monthStart);
    listEventsResult = [
      appointmentAt("m1", at(0.2), at(0.2) + short, { attended: false }),
      appointmentAt("m2", at(0.6), at(0.6) + short, { attended: false }),
      appointmentAt("h1", at(0.3), at(0.3) + short, { attended: true }),
      appointmentAt("u1", at(0.4), at(0.4) + short, {}),
      appointmentAt("r1", at(0.5), at(0.5) + short, { status: "REFUSE", attended: false }),
      appointmentAt("f1", now + 3_600_000, now + 7_200_000, {}),
      appointmentAt("straddle", monthStart - 3_600_000, at(0.01), { attended: false }),
    ];
  });

  it("valeur = attendance.missed du rapport du mois ; drill-down filtré sur « manqué » : même total, badges « Manqué »", async () => {
    render(<AgentRdvDashboardPage />);
    const card = await screen.findByRole("button", { name: /RDV manqués \(ce mois\)/ });
    expect(card.textContent).toBe("RDV manqués (ce mois)2");

    fireEvent.click(card);
    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-rdv-1" });

    expect(await screen.findByText("2 rendez-vous")).toBeInTheDocument(); // = chiffre de la carte
    expect(screen.getByText("RDV m1")).toBeInTheDocument();
    expect(screen.getByText("RDV m2")).toBeInTheDocument();
    for (const decoy of ["RDV h1", "RDV u1", "RDV r1", "RDV f1", "RDV straddle"]) {
      expect(screen.queryByText(decoy)).not.toBeInTheDocument();
    }
    expect(screen.getAllByText("Manqué")).toHaveLength(2);
  });
});
