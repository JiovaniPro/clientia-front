import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ login: vi.fn() }) }));

describe("/login — mot de passe oublié", () => {
  it("affiche un lien « Mot de passe oublié ? » vers /forgot-password, et plus aucun lien d'auto-inscription (sous-lot 2)", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "Mot de passe oublié ?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByRole("link", { name: "Créer une organisation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });
});
