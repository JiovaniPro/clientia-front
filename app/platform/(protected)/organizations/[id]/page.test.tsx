import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformOrganizationDetailDTO } from "@/lib/api/platformOrganizations";
import PlatformOrganizationDetailPage from "./page";

const api = vi.hoisted(() => ({ getOrganization: vi.fn(), deleteOrganization: vi.fn(), setOrganizationStatus: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "org-1" }) }));
// Référence stable : une nouvelle fonction à chaque rendu relancerait le chargement en boucle (useCallback).
const auth = vi.hoisted(() => ({ authedFetch: (fn: (token: string) => unknown) => fn("token") }));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({ usePlatformAuth: () => auth }));
vi.mock("@/lib/api/platformOrganizations", () => api);

const baseOrg: PlatformOrganizationDetailDTO = {
  id: "org-1",
  name: "Cabinet Rochat",
  slug: "cabinet-rochat",
  isActive: true,
  deletedAt: null,
  createdAt: "2026-09-04T10:00:00.000Z",
  _count: { users: 1 },
  users: [],
};

async function renderWith(org: Partial<PlatformOrganizationDetailDTO>) {
  api.getOrganization.mockResolvedValue({ ...baseOrg, ...org });
  render(<PlatformOrganizationDetailPage />);
  await screen.findByRole("heading", { name: "Cabinet Rochat" });
}

describe("Détail organisation — suppression", () => {
  beforeEach(() => vi.clearAllMocks());

  it("organisation active : bouton Supprimer désactivé, avec explication", async () => {
    await renderWith({ isActive: true });
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeDisabled();
    expect(screen.getByText(/Suspendez d'abord l'organisation/)).toBeInTheDocument();
  });

  it("organisation suspendue : suppression possible après saisie du nom exact", async () => {
    await renderWith({ isActive: false });
    api.deleteOrganization.mockResolvedValue({ ...baseOrg, isActive: false, deletedAt: "2026-10-01T08:00:00.000Z" });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    const confirm = screen.getByRole("button", { name: "Supprimer définitivement" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tapez « Cabinet Rochat » pour confirmer"), {
      target: { value: "Cabinet Rochat" },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(api.deleteOrganization).toHaveBeenCalledWith("org-1", "Cabinet Rochat", "token"));
    expect(await screen.findByText(/Organisation supprimée — plus aucun accès possible/)).toBeInTheDocument();
    // Lecture seule ensuite : plus aucune action.
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Réactiver" })).toBeNull();
  });

  it("organisation supprimée : lecture seule, ni suspendre/réactiver ni supprimer", async () => {
    await renderWith({ isActive: false, deletedAt: "2026-10-01T08:00:00.000Z" });
    expect(screen.getByText("Organisation supprimée · lecture seule")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Réactiver" })).toBeNull();
  });
});
