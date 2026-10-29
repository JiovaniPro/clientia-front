import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlatformOrganizationsPage from "./page";

const nav = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query) }));
const auth = vi.hoisted(() => ({ authedFetch: (fn: (token: string) => unknown) => fn("token") }));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({ usePlatformAuth: () => auth }));
const api = vi.hoisted(() => ({ setOrganizationStatus: vi.fn() }));
vi.mock("@/lib/api/platformOrganizations", () => ({
  setOrganizationStatus: api.setOrganizationStatus,
  deleteOrganization: vi.fn(),
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

describe("Liste des organisations — actions", () => {
  it("Suspendre ouvre une confirmation au lieu d'appeler l'API directement", async () => {
    nav.query = "";
    api.setOrganizationStatus.mockClear();
    render(<PlatformOrganizationsPage />);
    const row = (await screen.findByText("Org Active")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Suspendre" }));
    expect(screen.getByText("Suspendre cette organisation")).toBeInTheDocument();
    expect(api.setOrganizationStatus).not.toHaveBeenCalled();
  });

  it("Supprimer n'apparaît que sur les organisations suspendues", async () => {
    nav.query = "";
    render(<PlatformOrganizationsPage />);
    const activeRow = (await screen.findByText("Org Active")).closest("tr")!;
    const suspendedRow = screen.getByText("Org Suspendue").closest("tr")!;
    expect(within(activeRow).queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(within(suspendedRow).getByRole("button", { name: "Supprimer" })).toBeInTheDocument();
  });
});
