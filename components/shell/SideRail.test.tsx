import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SideRail } from "./SideRail";

let permissions: string[] = [];
let pathname = "/calls";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ hasPermission: (k: string) => permissions.includes(k) }) }));

const CALLISTE = ["calls.view", "calls.create", "clients.view", "reports.view", "notifications.view"];
const ADMIN = [...CALLISTE, "users.view", "roles.manage", "auditLog.view", "clients.viewAll"];

beforeEach(() => {
  pathname = "/calls";
  localStorage.clear();
});

describe("SideRail", () => {
  it("calliste : un seul groupe, pas de libellé « Administration » ; lien actif marqué", () => {
    permissions = CALLISTE;
    render(<SideRail />);
    expect(screen.queryByText("Administration")).toBeNull();
    expect(screen.getByRole("link", { name: "Appels" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dossiers" })).not.toHaveAttribute("aria-current");
    // Déplacés dans le menu de l'avatar (barre du haut).
    expect(screen.queryByText("Mon compte")).toBeNull();
    expect(screen.queryByText("Se déconnecter")).toBeNull();
  });

  it("admin : les écrans d'administration sont regroupés sous « Administration », après le travail quotidien", () => {
    permissions = ADMIN;
    render(<SideRail />);
    const adminList = screen.getByText("Administration").nextElementSibling as HTMLElement;
    const adminLinks = within(adminList).getAllByRole("link").map((l) => l.textContent);
    expect(adminLinks).toEqual(["Utilisateurs", "Rôles & permissions", "Journal d'audit"]);
    expect(within(adminList).queryByRole("link", { name: "Appels" })).toBeNull();
  });

  it("pas d'entrée Notifications dans le rail (la cloche de la barre du haut les ouvre)", () => {
    permissions = CALLISTE;
    render(<SideRail />);
    expect(screen.getByRole("link", { name: "Appels" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Notifications/ })).toBeNull();
  });

  it("« Rechercher » rejoue Ctrl+K (ouvre la palette de commandes)", () => {
    permissions = CALLISTE;
    const onKeyDown = vi.fn();
    window.addEventListener("keydown", onKeyDown);
    render(<SideRail />);
    fireEvent.click(screen.getByRole("button", { name: "Rechercher une page (Ctrl K)" }));
    window.removeEventListener("keydown", onKeyDown);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    const event = onKeyDown.mock.calls[0]![0] as KeyboardEvent;
    expect(event.key).toBe("k");
    expect(event.ctrlKey).toBe(true);
  });

  it("replié : libellés masqués, les liens gardent leur nom en info-bulle", () => {
    permissions = CALLISTE;
    render(<SideRail />);
    fireEvent.click(screen.getByRole("button", { name: "Replier le menu" }));
    expect(screen.queryByText("Rechercher…")).toBeNull();
    expect(screen.getByTitle("Appels")).toHaveAttribute("href", "/calls");
    expect(screen.getByRole("button", { name: "Déplier le menu" })).toBeInTheDocument();
  });
});
