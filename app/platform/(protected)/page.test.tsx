import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformHomePage from "./page";

// Référence stable : une nouvelle fonction à chaque rendu relancerait le chargement en boucle (useCallback).
const auth = vi.hoisted(() => ({
  platformAdmin: { name: "Camille Martin", email: "sa@test" },
  authedFetch: (fn: (token: string) => unknown) => fn("token"),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({ usePlatformAuth: () => auth }));
vi.mock("@/lib/api/platformDashboard", () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    organizations: { total: 10, active: 4, suspended: 6, deleted: 2 },
    users: { total: 16, connected: 3 },
    calls: { total: 1302 },
  }),
}));
const api = vi.hoisted(() => ({ listOrganizations: vi.fn(), setOrganizationStatus: vi.fn() }));
vi.mock("@/lib/api/platformOrganizations", () => api);

const ORGS = [
  { id: "a", name: "Cabinet Actif", slug: "cabinet-actif", isActive: true, deletedAt: null, createdAt: "2026-10-02T00:00:00Z", _count: { users: 4 } },
  { id: "s", name: "Courtage Suspendu", slug: "courtage-suspendu", isActive: false, deletedAt: null, createdAt: "2026-09-01T00:00:00Z", _count: { users: 2 } },
];

beforeEach(() => {
  push.mockReset();
  api.listOrganizations.mockReset().mockResolvedValue(ORGS);
  api.setOrganizationStatus.mockReset().mockResolvedValue({ ...ORGS[1], isActive: true });
});

describe("Accueil de la console", () => {
  it("salue par le prénom et propose la création d'une organisation", async () => {
    render(<PlatformHomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Bonjour, Camille" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nouvelle organisation" }).length).toBeGreaterThan(0);
    await screen.findByText("Cabinet Actif");
  });

  it("résumé : utilisateurs et appels annoncés sur les organisations actives, connectés sans prétention temps réel", async () => {
    render(<PlatformHomePage />);
    expect(await screen.findAllByText("dans les organisations actives")).toHaveLength(2);
    const detail = screen.getByText("Connectés dans les 15 dernières minutes");
    expect(detail.parentElement!.parentElement).toHaveTextContent("3");
    expect(screen.queryByText(/maintenant|en direct|temps réel/i)).toBeNull();
  });

  it("suspendues et supprimées mènent à leur liste", async () => {
    render(<PlatformHomePage />);
    const suspended = await screen.findByRole("link", { name: /^Suspendues/ });
    expect(suspended).toHaveAttribute("href", "/platform/organizations?statut=suspendues");
    expect(suspended).toHaveTextContent("6");
    const deleted = screen.getByRole("link", { name: /^Supprimées/ });
    expect(deleted).toHaveAttribute("href", "/platform/organizations/deleted");
    expect(deleted).toHaveTextContent("2");
  });

  it("« À vérifier » liste les organisations suspendues ; Réactiver appelle l'API et l'annonce", async () => {
    render(<PlatformHomePage />);
    const section = (await screen.findByRole("heading", { name: /À vérifier/ })).closest("section")!;
    expect(within(section).getByText("Courtage Suspendu")).toBeInTheDocument();
    expect(within(section).queryByText("Cabinet Actif")).toBeNull();

    fireEvent.click(within(section).getByRole("button", { name: "Réactiver" }));

    await waitFor(() => expect(api.setOrganizationStatus).toHaveBeenCalledWith("s", true, "token"));
    expect(await screen.findByText(/« Courtage Suspendu » réactivée/)).toBeInTheDocument();
  });

  it("aucune organisation suspendue : pas de section « À vérifier »", async () => {
    api.listOrganizations.mockResolvedValue([ORGS[0]]);
    render(<PlatformHomePage />);
    await screen.findByText("Cabinet Actif");
    expect(screen.queryByRole("heading", { name: /À vérifier/ })).toBeNull();
  });
});
