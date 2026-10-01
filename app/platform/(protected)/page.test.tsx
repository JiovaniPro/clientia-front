import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformHomePage from "./page";

// Référence stable : une nouvelle fonction à chaque rendu relancerait le chargement en boucle (useCallback).
const auth = vi.hoisted(() => ({
  platformAdmin: { name: "Super Admin", email: "sa@test" },
  authedFetch: (fn: (token: string) => unknown) => fn("token"),
}));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({ usePlatformAuth: () => auth }));
vi.mock("@/lib/api/platformDashboard", () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    organizations: { total: 10, active: 4, suspended: 6, deleted: 2 },
    users: { total: 16, connected: 3 },
    calls: { total: 1302 },
  }),
}));

describe("Tableau de bord Super Admin", () => {
  it("utilisateurs et appels annoncés sur les organisations actives uniquement", async () => {
    render(<PlatformHomePage />);
    expect(await screen.findAllByText("dans les organisations actives")).toHaveLength(2);
    expect(screen.queryByText(/toutes organisations confondues/)).toBeNull();
  });

  it("carte Utilisateurs connectés : libellé exact, sans prétention temps réel", async () => {
    render(<PlatformHomePage />);
    const detail = await screen.findByText("Connectés dans les 15 dernières minutes");
    expect(detail.parentElement).toHaveTextContent("3");
    expect(screen.queryByText(/maintenant|en direct|temps réel/i)).toBeNull();
  });

  it("cartes suspendues et supprimées cliquables vers leur liste", async () => {
    render(<PlatformHomePage />);
    const suspended = await screen.findByRole("link", { name: /Organisations suspendues/ });
    expect(suspended).toHaveAttribute("href", "/platform/organizations?statut=suspendues");
    expect(suspended).toHaveTextContent("6");
    const deleted = screen.getByRole("link", { name: /Organisations supprimées/ });
    expect(deleted).toHaveAttribute("href", "/platform/organizations/deleted");
    expect(deleted).toHaveTextContent("2");
  });
});
