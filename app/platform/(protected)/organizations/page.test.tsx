import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformOrganizationsPage from "./page";

const nav = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query) }));
const auth = vi.hoisted(() => ({ authedFetch: (fn: (token: string) => unknown) => fn("token") }));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({ usePlatformAuth: () => auth }));
vi.mock("@/lib/api/platformOrganizations", () => ({
  setOrganizationStatus: vi.fn(),
  listOrganizations: vi.fn().mockResolvedValue([
    { id: "a", name: "Org Active", slug: "a", isActive: true, deletedAt: null, createdAt: "2026-09-01T00:00:00Z", _count: { users: 1 } },
    { id: "s", name: "Org Suspendue", slug: "s", isActive: false, deletedAt: null, createdAt: "2026-09-01T00:00:00Z", _count: { users: 1 } },
  ]),
}));

describe("Liste des organisations — filtre par statut", () => {
  it("?statut=suspendues n'affiche que les suspendues", async () => {
    nav.query = "statut=suspendues";
    render(<PlatformOrganizationsPage />);
    expect(await screen.findByText("Org Suspendue")).toBeInTheDocument();
    expect(screen.queryByText("Org Active")).toBeNull();
    expect(screen.getByRole("link", { name: "Suspendues" })).toHaveAttribute("aria-current", "page");
  });

  it("sans filtre, tout est affiché", async () => {
    nav.query = "";
    render(<PlatformOrganizationsPage />);
    expect(await screen.findByText("Org Active")).toBeInTheDocument();
    expect(screen.getByText("Org Suspendue")).toBeInTheDocument();
  });
});
