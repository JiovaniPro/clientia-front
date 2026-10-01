import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "@/app/(app)/account/page";
import AdminOrganizationPage from "@/app/(app)/admin/organization/page";
import PlatformChangePasswordPage from "@/app/platform/(protected)/change-password/page";

/** §6.25 lot E — formulaires inline : beforeunload seulement ; jamais sur les mots de passe. */
const updateMe = vi.fn();
const updateCurrentOrganization = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/api/auth", () => ({ updateMe: (...a: unknown[]) => updateMe(...a), changePassword: vi.fn() }));
vi.mock("@/lib/api/organizations", () => ({
  getCurrentOrganization: vi.fn(() => Promise.resolve({ id: "o1", name: "Acme", logoUrl: null, primaryColor: "#123456" })),
  updateCurrentOrganization: (...a: unknown[]) => updateCurrentOrganization(...a),
}));
vi.mock("@/lib/api/platformAuth", () => ({ changePlatformPassword: vi.fn() }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
const USER = { id: "u1", firstName: "Alix", lastName: "Admin", email: "alix@acme.fr", roleName: "Admin", organization: { name: "Acme" } };
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch, user: USER, updateUser: vi.fn() }) }));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ authedFetch, platformAdmin: { mustChangePassword: false }, setPlatformAdmin: vi.fn(), logout: vi.fn() }),
}));

function beforeUnloadBlocked() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const typePasswords = () => {
  type("Mot de passe actuel", "ancien-secret");
  type("Nouveau mot de passe", "nouveau-secret");
  type("Confirmer le nouveau mot de passe", "nouveau-secret");
};

beforeEach(() => {
  updateMe.mockReset();
  updateCurrentOrganization.mockReset();
});

describe("§6.25 lot E — AccountPage", () => {
  it("Informations : inactif sans modification, actif après, inactif après enregistrement réussi", async () => {
    updateMe.mockResolvedValue({ user: { ...USER, firstName: "Alexandra" } });
    render(<AccountPage />);
    expect(beforeUnloadBlocked()).toBe(false);
    type("Prénom", "Alexandra");
    expect(beforeUnloadBlocked()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Informations mises à jour.");
    // La réinitialisation de la garde se fait dans un effet, possiblement après l'affichage du message.
    await vi.waitFor(() => expect(beforeUnloadBlocked()).toBe(false));
  });

  it("Mot de passe : jamais surveillé, même après saisie des trois champs", () => {
    render(<AccountPage />);
    typePasswords();
    expect(beforeUnloadBlocked()).toBe(false);
  });
});

describe("§6.25 lot E — admin/organization", () => {
  it("organisation chargée (couleur ≠ défaut) : inactif — ready évite le faux positif", async () => {
    render(<AdminOrganizationPage />);
    await vi.waitFor(() => expect(screen.getByLabelText("Nom de l'organisation")).toHaveValue("Acme"));
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it("actif après modification, inactif après enregistrement réussi", async () => {
    updateCurrentOrganization.mockResolvedValue({ id: "o1", name: "Acme Corp", logoUrl: null, primaryColor: "#123456" });
    render(<AdminOrganizationPage />);
    await vi.waitFor(() => expect(screen.getByLabelText("Nom de l'organisation")).toHaveValue("Acme"));
    type("Nom de l'organisation", "Acme Corp");
    expect(beforeUnloadBlocked()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Paramètres enregistrés.");
    await vi.waitFor(() => expect(beforeUnloadBlocked()).toBe(false));
  });
});

describe("§6.25 lot E — change-password (plateforme)", () => {
  it("jamais surveillé, même après saisie des trois champs", () => {
    render(<PlatformChangePasswordPage />);
    typePasswords();
    expect(beforeUnloadBlocked()).toBe(false);
  });
});
