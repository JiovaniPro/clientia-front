import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

const switchOrganization = vi.fn();
let organizations: { slug: string; name: string; current: boolean }[] = [];
const user = { id: "u1", organization: { id: "o1", name: "Alpha Conseil", slug: "alpha" } };
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ user, organizations, switchOrganization }) }));

beforeEach(() => {
  switchOrganization.mockReset();
  organizations = [];
});

describe("OrganizationSwitcher (rail gauche)", () => {
  it("une seule organisation : nom affiché, rien à ouvrir", () => {
    organizations = [{ slug: "alpha", name: "Alpha Conseil", current: true }];
    render(<OrganizationSwitcher />);
    expect(screen.getByText("Alpha Conseil")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("plusieurs organisations : la liste s'ouvre, l'organisation ouverte est cochée et inactive, un clic bascule", async () => {
    organizations = [
      { slug: "alpha", name: "Alpha Conseil", current: true },
      { slug: "beta", name: "Beta Courtage", current: false },
    ];
    switchOrganization.mockResolvedValue(undefined);
    render(<OrganizationSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /changer d'organisation/ }));
    expect(screen.getByRole("menuitem", { name: "Alpha Conseil" })).toBeDisabled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Beta Courtage" }));
    await waitFor(() => expect(switchOrganization).toHaveBeenCalledWith("beta"));
  });

  it("refus du serveur : message affiché, la liste reste utilisable", async () => {
    organizations = [
      { slug: "alpha", name: "Alpha Conseil", current: true },
      { slug: "beta", name: "Beta Courtage", current: false },
    ];
    switchOrganization.mockRejectedValue(new ApiError(403, "Cette organisation n'est pas accessible depuis votre session"));
    render(<OrganizationSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /changer d'organisation/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Beta Courtage" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cette organisation n'est pas accessible depuis votre session");
    expect(screen.getByRole("menuitem", { name: "Beta Courtage" })).toBeEnabled();
  });
});
