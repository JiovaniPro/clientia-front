import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentRdvDashboardPage from "./page";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
// Recharts n'a pas de mise en page sous jsdom : le graphique est hors sujet ici (les chiffres sont testés via les tuiles).
vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: Stub, BarChart: Stub, Bar: Stub, Cell: Stub, CartesianGrid: Stub, XAxis: Stub, YAxis: Stub, Tooltip: Stub };
});

const getSignedContractsCount = vi.fn();
const getAppointmentsReport = vi.fn();
vi.mock("@/lib/api/reports", () => ({
  getSignedContractsCount: (...a: unknown[]) => getSignedContractsCount(...a),
  getAppointmentsReport: (...a: unknown[]) => getAppointmentsReport(...a),
}));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
let permissions = ["calendar.manageAppointments"];
// Référence stable (comme le useCallback réel) : sinon les effets se relanceraient à chaque rendu.
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

function appointmentsWith(statuses: string[], attendance = { honored: 0, missed: 0, unmarked: 0 }) {
  const byStatus = Object.entries(
    statuses.reduce((acc: Record<string, number>, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {}),
  ).map(([status, count]) => ({ status, count }));
  return { total: statuses.length, byStatus, attendance };
}

/**
 * Ordre des appels à getAppointmentsReport (celui des effets de la page) : 7 prochains jours, RDV
 * d'aujourd'hui, période choisie, période précédente. Au-delà : rapport vide.
 */
function mockReports(
  reports: { today?: object; upcoming?: object; period?: object; previous?: object } = {},
) {
  const empty = appointmentsWith([]);
  getAppointmentsReport.mockReset();
  getAppointmentsReport
    .mockResolvedValueOnce(reports.upcoming ?? empty)
    .mockResolvedValueOnce(reports.today ?? empty)
    .mockResolvedValueOnce(reports.period ?? empty)
    .mockResolvedValueOnce(reports.previous ?? empty)
    .mockResolvedValue(empty);
}

describe("/agent-rdv/dashboard — tuiles RDV", () => {
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
    mockReports({
      upcoming: appointmentsWith(["CONFIRME", "EN_ATTENTE_DE_CONFIRMATION"]),
      period: appointmentsWith(["REFUSE", "REFUSE", "ANNULE"]),
    });
  });

  it("« RDV à venir (7 jours) » : bouton, ouvre la modale avec agentRdvId = l'agent connecté et le filtre des statuts actifs", async () => {
    render(<AgentRdvDashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: /RDV à venir \(7 jours\)/ }));

    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-rdv-1" });
    // Titre de la modale = libellé de la carte ; distinct de la carte source, encore affichée derrière.
    expect(screen.getByRole("heading", { name: "RDV à venir (7 jours)" })).toBeInTheDocument();
  });

  it("« Refusés » : valeur du rapport de la période ; bouton, ouvre la modale avec agentRdvId = l'agent connecté", async () => {
    render(<AgentRdvDashboardPage />);
    const card = await screen.findByRole("button", { name: /Refusés/ });
    expect(card.textContent).toContain("Refusés2");

    fireEvent.click(card);
    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-rdv-1" });
    expect(screen.getByRole("heading", { name: "Refusés — 30 derniers jours et à venir" })).toBeInTheDocument();
  });

  it("« Annulés » : valeur du rapport, drill-down sur les RDV annulés de l'agent connecté", async () => {
    render(<AgentRdvDashboardPage />);
    const card = await screen.findByRole("button", { name: /Annulés/ });
    expect(card.textContent).toContain("Annulés1");

    fireEvent.click(card);
    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-rdv-1" });
    expect(screen.getByRole("heading", { name: "Annulés — 30 derniers jours et à venir" })).toBeInTheDocument();
  });

  it("la période inclut les RDV À VENIR (un RDV annulé pour la semaine prochaine doit apparaître) : le rapport court jusqu'à ~90 jours", async () => {
    render(<AgentRdvDashboardPage />);
    await screen.findByRole("button", { name: /Annulés/ });
    const periodQuery = getAppointmentsReport.mock.calls[2]![0] as { from: Date; to: Date };
    const days = (periodQuery.to.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(85);
    expect(days).toBeLessThan(91);
  });

  it("changer de période recharge le rapport de la période et retitre les tuiles", async () => {
    render(<AgentRdvDashboardPage />);
    await screen.findByRole("button", { name: /Refusés/ });
    expect(getAppointmentsReport).toHaveBeenCalledTimes(4);

    fireEvent.click(screen.getByRole("button", { name: "7 derniers jours" }));
    await waitFor(() => expect(getAppointmentsReport).toHaveBeenCalledTimes(6)); // période + précédente
    fireEvent.click(await screen.findByRole("button", { name: /Refusés/ }));
    expect(screen.getByRole("heading", { name: "Refusés — 7 derniers jours et à venir" })).toBeInTheDocument();
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

  it("échec du chargement : message d'erreur avec relance, qui recharge", async () => {
    getSignedContractsCount.mockRejectedValueOnce(new Error("boom"));
    render(<AgentRdvDashboardPage />);

    expect(await screen.findByText("Impossible de charger le tableau de bord.")).toBeInTheDocument();
    mockReports();
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
    await screen.findByText("Contrats signés (ce mois)");
    expect(screen.queryByText("Impossible de charger le tableau de bord.")).not.toBeInTheDocument();
  });
});

describe("/agent-rdv/dashboard — « À traiter » : RDV en attente de ma confirmation", () => {
  beforeEach(() => {
    getSignedContractsCount.mockResolvedValue({ count: 0 });
    mockReports();
    permissions = ["calendar.manageAppointments"];
    getPendingAppointmentsCount.mockReset();
  });

  it("count > 0 : tuile avec le bon compte, lien vers /calendar-pro", async () => {
    getPendingAppointmentsCount.mockResolvedValue({ count: 3 });
    render(<AgentRdvDashboardPage />);

    const tile = await screen.findByRole("link", { name: /3\s*rendez-vous en attente de votre confirmation/ });
    expect(tile).toHaveAttribute("href", "/calendar-pro");
    expect(getPendingAppointmentsCount).toHaveBeenCalledWith("tok");
  });

  it("count = 0 : la tuile reste affichée, à zéro", async () => {
    getPendingAppointmentsCount.mockResolvedValue({ count: 0 });
    render(<AgentRdvDashboardPage />);

    expect(await screen.findByRole("link", { name: /0\s*rendez-vous en attente de votre confirmation/ })).toBeInTheDocument();
  });

  it("sans calendar.manageAppointments : aucun appel, pas de tuile", async () => {
    permissions = [];
    getPendingAppointmentsCount.mockResolvedValue({ count: 5 });
    render(<AgentRdvDashboardPage />);

    await screen.findByText("Contrats signés (ce mois)");
    expect(getPendingAppointmentsCount).not.toHaveBeenCalled();
    expect(screen.queryByText(/en attente de votre confirmation/)).not.toBeInTheDocument();
  });

  it("échec de l'appel : tuile cachée, le reste du dashboard s'affiche", async () => {
    getPendingAppointmentsCount.mockRejectedValue(new Error("boom"));
    render(<AgentRdvDashboardPage />);

    await screen.findByText("Contrats signés (ce mois)");
    expect(screen.queryByText(/en attente de votre confirmation/)).not.toBeInTheDocument();
    expect(screen.queryByText("Impossible de charger le tableau de bord.")).not.toBeInTheDocument();
  });

  it("« rendez-vous aujourd'hui » : compte les RDV actifs du jour, lien vers l'agenda", async () => {
    getPendingAppointmentsCount.mockResolvedValue({ count: 0 });
    mockReports({ today: appointmentsWith(["CONFIRME", "EN_ATTENTE_DE_CONFIRMATION", "REFUSE"]) });
    render(<AgentRdvDashboardPage />);

    const tile = await screen.findByRole("link", { name: /2\s*rendez-vous aujourd'hui/ });
    expect(tile).toHaveAttribute("href", "/agent-rdv/calendar");
  });
});

/**
 * Sous-lot 4 honoré/manqué — correspondance exacte tuile ↔ drill-down : la liste renvoyée par
 * GET /calendar-events contient des leurres (honoré, non marqué, futur, refusé, et un manqué qui
 * commence avant la période, que le rapport ne compte pas) ; la modale filtrée doit afficher
 * exactement le chiffre de la tuile.
 */
describe("/agent-rdv/dashboard — tuile « RDV manqués »", () => {
  function appointmentAt(id: string, start: number, end: number, extra: Record<string, unknown>) {
    return { id, title: `RDV ${id}`, type: "APPOINTMENT", status: "CONFIRME", attended: null,
      startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), ...extra };
  }

  beforeEach(() => {
    listEventsCalls = [];
    getSignedContractsCount.mockResolvedValue({ count: 0 });
    getPendingAppointmentsCount.mockResolvedValue({ count: 0 });
    mockReports({
      period: appointmentsWith(["CONFIRME", "CONFIRME"], { honored: 1, missed: 2, unmarked: 1 }),
      previous: appointmentsWith(["CONFIRME"], { honored: 1, missed: 1, unmarked: 0 }),
    });

    // Instants relatifs à la plage réelle de la période (30 jours, depuis minuit) : robustes quel que soit le jour.
    const now = Date.now();
    const periodStart = new Date(now - 29 * 24 * 60 * 60 * 1000);
    periodStart.setHours(0, 0, 0, 0);
    const start = periodStart.getTime();
    const at = (f: number) => start + f * (now - start);
    const short = 0.02 * (now - start);
    listEventsResult = [
      appointmentAt("m1", at(0.2), at(0.2) + short, { attended: false }),
      appointmentAt("m2", at(0.6), at(0.6) + short, { attended: false }),
      appointmentAt("h1", at(0.3), at(0.3) + short, { attended: true }),
      appointmentAt("u1", at(0.4), at(0.4) + short, {}),
      appointmentAt("r1", at(0.5), at(0.5) + short, { status: "REFUSE", attended: false }),
      appointmentAt("f1", now + 3_600_000, now + 7_200_000, {}),
      appointmentAt("straddle", start - 3_600_000, at(0.01), { attended: false }),
    ];
  });

  it("valeur = attendance.missed du rapport de la période ; drill-down filtré sur « manqué » : même total, badges « Manqué »", async () => {
    render(<AgentRdvDashboardPage />);
    const card = await screen.findByRole("button", { name: /RDV manqués/ });
    expect(card.textContent).toContain("RDV manqués2");
    expect(card.textContent).toContain("sur 4 rendez-vous terminés");

    fireEvent.click(card);
    await waitFor(() => expect(listEventsCalls).toHaveLength(1));
    expect(listEventsCalls[0]![0]).toMatchObject({ type: "APPOINTMENT", agentRdvId: "agent-rdv-1" });

    expect(await screen.findByText("2 rendez-vous")).toBeInTheDocument(); // = chiffre de la tuile
    expect(screen.getByText("RDV m1")).toBeInTheDocument();
    expect(screen.getByText("RDV m2")).toBeInTheDocument();
    for (const decoy of ["RDV h1", "RDV u1", "RDV r1", "RDV f1", "RDV straddle"]) {
      expect(screen.queryByText(decoy)).not.toBeInTheDocument();
    }
    expect(screen.getAllByText("Manqué")).toHaveLength(2);
  });

  it("suivi des présences : taux de présence, répartition honorés / manqués / non marqués, lien pour marquer", async () => {
    render(<AgentRdvDashboardPage />);
    expect(await screen.findByText("Suivi des présences")).toBeInTheDocument();
    expect(screen.getByText("33 %")).toBeInTheDocument(); // 1 honoré / (1 + 2 manqués)
    for (const label of ["Honorés", "Manqués", "Non marqués"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Marquer ce rendez-vous dans l'agenda/ })).toHaveAttribute("href", "/agent-rdv/calendar");
  });
});
