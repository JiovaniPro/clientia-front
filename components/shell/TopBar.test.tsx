import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

const push = vi.fn();
const authedFetch = vi.fn();
const logout = vi.fn();
let permissions: string[] = [];

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/calls" }));
const user = { id: "u1", firstName: "Camille", lastName: "Calliste", email: "c@x", roleName: "Agent calliste" };
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({ user, logout, authedFetch, hasPermission: (k: string) => permissions.includes(k) }),
}));

beforeEach(() => {
  permissions = ["notifications.view"];
  push.mockReset();
  logout.mockReset();
  logout.mockResolvedValue(undefined);
});

describe("TopBar", () => {
  it("« Bonjour, nom » ; cloche avec pastille annoncée ; menu fermé par défaut", () => {
    render(<TopBar showNotificationsBadge />);
    expect(screen.getByText(/Bonjour,/)).toHaveTextContent("Bonjour, Camille Calliste");
    expect(screen.getByRole("button", { name: "Notifications — nouvelles notifications" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("sans notifications.view : pas de cloche", () => {
    permissions = [];
    render(<TopBar />);
    expect(screen.queryByRole("button", { name: /Notifications/ })).toBeNull();
  });

  it("clic sur la cloche : tiroir des 5 dernières, non lues signalées, sans changer de page", async () => {
    authedFetch.mockResolvedValue({
      unreadCount: 1,
      page: 1,
      pageSize: 5,
      items: [
        { id: "n1", title: "Rendez-vous assigné", body: "Camille Rochat", readAt: null, meta: null, createdAt: new Date().toISOString() },
        { id: "n2", title: "Rendez-vous confirmé", body: null, readAt: new Date().toISOString(), meta: null, createdAt: new Date().toISOString() },
      ],
    });
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Rendez-vous assigné")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getAllByText("Non lu")).toHaveLength(1);
    expect(screen.getByText("1 non lue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir toutes les notifications" })).toHaveAttribute("href", "/notifications");
    expect(push).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clic sur l'avatar : menu Mon compte / Se déconnecter ; Échap le referme", () => {
    render(<TopBar />);
    const trigger = screen.getByRole("button", { name: "Menu du compte" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Mon compte" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("menuitem", { name: "Se déconnecter" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Se déconnecter : confirmation, puis logout et retour au login ; Annuler ne déconnecte pas", async () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
    expect(screen.getByText("Se déconnecter maintenant ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Menu du compte" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});

describe("TopBar — mode sombre", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.clear();
  });

  it("bascule la classe .dark sur <html>, mémorise le choix, et le libellé suit", () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Passer en mode sombre" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("clientia:theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Passer en mode clair" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("clientia:theme")).toBe("light");
  });

  it("script d'initialisation : réapplique le thème sombre mémorisé, ne fait rien sinon", async () => {
    const { THEME_INIT_SCRIPT } = await import("@/lib/theme");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    localStorage.setItem("clientia:theme", "dark");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
