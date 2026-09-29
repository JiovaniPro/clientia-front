import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ login: vi.fn() }) }));

describe("/login — mot de passe oublié", () => {
  it("affiche un lien « Mot de passe oublié ? » vers /forgot-password, sans retirer le lien de création d'organisation", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "Mot de passe oublié ?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Créer une organisation" })).toHaveAttribute("href", "/register-organization");
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });
});
