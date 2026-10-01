import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShellLayout from "./layout";

const replace = vi.fn();
let pathname = "/today";
let auth: { user: object | null; isLoading: boolean; permissions: string[] };

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => pathname }));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoading: auth.isLoading, hasPermission: (k: string) => auth.permissions.includes(k) }),
}));
vi.mock("@/components/shell/SideRail", () => ({ SideRail: () => null }));
vi.mock("@/components/shell/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/shell/ReminderPopupListener", () => ({ ReminderPopupListener: () => null }));

// Permissions par défaut de chaque rôle démo (voir lib/defaultRoles.ts côté backend) — la détection reste par capacité.
const AGENT_RDV = ["calendar.manageAppointments", "clients.view", "reports.view", "calendar.view"];
const CALLISTE = ["calls.view", "calls.create", "clients.view", "reports.view"];
const ADMIN = [...AGENT_RDV, ...CALLISTE, "clients.viewAll", "users.view", "calls.viewAll"];

function renderLayout(permissions: string[], path = "/today") {
  pathname = path;
  auth = { user: { id: "u1" }, isLoading: false, permissions };
  render(<AppShellLayout params={Promise.resolve({})}><p>contenu de la page</p></AppShellLayout>);
}

describe("layout (app) — redirection de l'Agent RDV depuis /today", () => {
  beforeEach(() => replace.mockReset());

  it("Agent RDV sur /today : redirigé vers /agent-rdv/dashboard, sans jamais rendre la page", () => {
    renderLayout(AGENT_RDV);
    expect(replace).toHaveBeenCalledWith("/agent-rdv/dashboard");
    expect(screen.queryByText("contenu de la page")).not.toBeInTheDocument();
  });

  it("Agent RDV ailleurs que sur /today : aucune redirection", () => {
    renderLayout(AGENT_RDV, "/notifications");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("contenu de la page")).toBeInTheDocument();
  });

  it("Admin sur /today : pas de redirection, page rendue (a calendar.manageAppointments mais aussi clients.viewAll/users.view)", () => {
    renderLayout(ADMIN);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("contenu de la page")).toBeInTheDocument();
  });

  it("Agent calliste sur /today : pas de redirection, page rendue", () => {
    renderLayout(CALLISTE);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("contenu de la page")).toBeInTheDocument();
  });

  it("non connecté sur /today : redirigé vers /login, page jamais rendue", () => {
    pathname = "/today";
    auth = { user: null, isLoading: false, permissions: [] };
    render(<AppShellLayout params={Promise.resolve({})}><p>contenu de la page</p></AppShellLayout>);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("contenu de la page")).not.toBeInTheDocument();
  });
});
