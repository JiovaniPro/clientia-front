import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootPage from "./page";

const replace = vi.fn();
let auth: { user: object | null; isLoading: boolean; permissions: string[] };

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoading: auth.isLoading, hasPermission: (k: string) => auth.permissions.includes(k) }),
}));

const AGENT_RDV = ["calendar.manageAppointments", "clients.view", "reports.view", "calendar.view"];
const CALLISTE = ["calls.view", "calls.create", "clients.view", "reports.view"];
const ADMIN = [...AGENT_RDV, ...CALLISTE, "clients.viewAll", "users.view", "calls.viewAll"];

function renderAs(user: object | null, isLoading: boolean, permissions: string[] = []) {
  auth = { user, isLoading, permissions };
  render(<RootPage />);
}
// Sous-lot 3 : la landing complète a pour titre la proposition de valeur (le placeholder avait « CLIENTIA »).
const landingShown = () => screen.queryByRole("heading", { level: 1, name: /De l'appel au rendez-vous/ });

describe("/ — aiguillage landing / écran de départ (sous-lot 2)", () => {
  beforeEach(() => replace.mockReset());

  it("visiteur non connecté : landing avec lien de connexion, aucune redirection", () => {
    renderAs(null, false);
    expect(landingShown()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    expect(replace).not.toHaveBeenCalled();
  });

  it("session en cours de vérification : écran neutre, jamais la landing", () => {
    renderAs(null, true);
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
    expect(landingShown()).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ["Administrateur", ADMIN, "/today"],
    ["Agent calliste", CALLISTE, "/today"],
    ["Agent RDV", AGENT_RDV, "/agent-rdv/dashboard"],
  ])("%s connecté : redirigé vers %s, sans rendu de la landing", (_role, permissions, target) => {
    renderAs({ id: "u1" }, false, permissions);
    expect(replace).toHaveBeenCalledWith(target);
    expect(landingShown()).not.toBeInTheDocument();
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });
});
