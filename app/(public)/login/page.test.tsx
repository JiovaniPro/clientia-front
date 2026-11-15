import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const login = vi.fn();
const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => search }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ login }) }));

function fillAndSubmit(email = "alix@demo.clientia.app", password = "Passw0rd!") {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

beforeEach(() => {
  login.mockReset();
  push.mockReset();
  search = new URLSearchParams();
});

describe("/login — mot de passe oublié", () => {
  it("affiche un lien « Mot de passe oublié ? » vers /forgot-password, et plus aucun lien d'auto-inscription (sous-lot 2)", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "Mot de passe oublié ?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByRole("link", { name: "Créer une organisation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });
});

describe("/login — sans espace de travail", () => {
  it("aucun champ « Espace de travail » ; e-mail + mot de passe suffisent, puis redirection", async () => {
    login.mockResolvedValue(undefined);
    render(<LoginPage />);
    expect(screen.queryByLabelText("Espace de travail")).not.toBeInTheDocument();

    fillAndSubmit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(login).toHaveBeenCalledWith({ organizationSlug: undefined, email: "alix@demo.clientia.app", password: "Passw0rd!" });
  });

  it("?org= dans l'URL fixe l'organisation sans rien demander", async () => {
    search = new URLSearchParams("org=alpha");
    login.mockResolvedValue(undefined);
    render(<LoginPage />);
    fillAndSubmit();
    await waitFor(() => expect(login).toHaveBeenCalledWith(expect.objectContaining({ organizationSlug: "alpha" })));
  });
});
