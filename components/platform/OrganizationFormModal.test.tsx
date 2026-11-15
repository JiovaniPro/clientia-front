import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizationFormModal } from "./OrganizationFormModal";

const api = vi.hoisted(() => ({ createOrganization: vi.fn() }));
vi.mock("@/lib/api/platformOrganizations", () => api);
const auth = vi.hoisted(() => ({ authedFetch: (fn: (token: string) => unknown) => fn("token") }));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({ usePlatformAuth: () => auth }));

describe("OrganizationFormModal — invitation au lieu d'un mot de passe", () => {
  it("aucun champ mot de passe ; la création n'envoie pas de mot de passe et annonce l'invitation", async () => {
    api.createOrganization.mockResolvedValue({ id: "o1", users: [] });
    const onSaved = vi.fn();
    render(<OrganizationFormModal onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.queryByLabelText(/mot de passe/i)).toBeNull();
    expect(screen.getByText(/e-mail d'invitation sera envoyé/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nom de l'organisation"), { target: { value: "Org" } });
    fireEvent.change(screen.getByLabelText("Identifiant de l'espace de travail"), { target: { value: "org" } });
    fireEvent.change(screen.getByLabelText("E-mail administrateur"), { target: { value: "a@b.fr" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const payload = api.createOrganization.mock.calls[0]![0];
    expect(payload).toEqual({ organizationName: "Org", organizationSlug: "org", adminEmail: "a@b.fr" });
  });
});

describe("OrganizationFormModal — identifiant et validation", () => {
  it("l'identifiant suit le nom (accents et ponctuation retirés) tant qu'il n'est pas modifié à la main", () => {
    render(<OrganizationFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    const name = screen.getByLabelText("Nom de l'organisation");
    const slug = screen.getByLabelText("Identifiant de l'espace de travail");

    fireEvent.change(name, { target: { value: "Cabinet Dupont & Fils — Genève" } });
    expect(slug).toHaveValue("cabinet-dupont-fils-geneve");

    fireEvent.change(slug, { target: { value: "dupont" } });
    fireEvent.change(name, { target: { value: "Autre nom" } });
    expect(slug).toHaveValue("dupont");
  });

  it("champs requis vides ou invalides : erreurs sous chaque champ, aucun appel API", async () => {
    api.createOrganization.mockClear();
    render(<OrganizationFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Identifiant de l'espace de travail"), { target: { value: "Pas Valide!" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    expect(await screen.findByText("Indiquez le nom de l'organisation.")).toBeInTheDocument();
    expect(screen.getByText("Lettres minuscules, chiffres et tirets uniquement.")).toBeInTheDocument();
    expect(screen.getByText("Indiquez l'e-mail de l'administrateur.")).toBeInTheDocument();
    expect(api.createOrganization).not.toHaveBeenCalled();
  });
});
