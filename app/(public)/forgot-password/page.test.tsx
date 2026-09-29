import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { FORGOT_PASSWORD_SUCCESS_MESSAGE } from "@/lib/auth/messages";
import ForgotPasswordPage from "./page";

const post = vi.fn();
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiClient: { post: (...args: unknown[]) => post(...args) },
}));

function fill(slug: string, email: string) {
  fireEvent.change(screen.getByLabelText("Espace de travail"), { target: { value: slug } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
}
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));

describe("/forgot-password", () => {
  beforeEach(() => post.mockReset());

  it("formulaire : espace de travail et e-mail, tous deux requis, comme le login", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("Espace de travail")).toBeRequired();
    expect(screen.getByLabelText("E-mail")).toBeRequired();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByRole("link", { name: "Retour à la connexion" })).toHaveAttribute("href", "/login");
  });

  it("soumet POST /auth/forgot-password avec { organizationSlug, email } (sans jeton d'accès) puis affiche le message générique", async () => {
    post.mockResolvedValue({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
    render(<ForgotPasswordPage />);
    fill("demo", "alix@demo.clientia.app");
    submit();

    expect(await screen.findByText("Si un compte existe avec cet e-mail, un lien a été envoyé.")).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/auth/forgot-password", { organizationSlug: "demo", email: "alix@demo.clientia.app" });
    expect(screen.queryByRole("button", { name: "Envoyer le lien" })).not.toBeInTheDocument();
  });

  it("MÊME message affiché quel que soit le résultat réel côté serveur : le corps de la réponse n'est jamais lu ni affiché", async () => {
    // Des corps de réponse volontairement DIFFÉRENTS (et même trompeurs) pour des demandes acceptées : l'écran affiche toujours la même chose.
    const serverBodies: unknown[] = [
      { message: "Si un compte existe avec cet e-mail, un lien a été envoyé." },
      { message: "Compte introuvable" },
      { message: "Lien envoyé à alix@demo.clientia.app", accountExists: true },
      {},
      undefined,
      null,
    ];
    const rendered: string[] = [];
    for (const body of serverBodies) {
      post.mockReset();
      post.mockResolvedValue(body);
      const { container, unmount } = render(<ForgotPasswordPage />);
      fill("demo", "quelquun@exemple.test");
      submit();
      await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
      rendered.push(screen.getByRole("status").textContent ?? "");
      expect(container.textContent).not.toContain("introuvable");
      expect(container.textContent).not.toContain("accountExists");
      unmount();
    }
    expect(new Set(rendered)).toEqual(new Set([FORGOT_PASSWORD_SUCCESS_MESSAGE]));
    expect(rendered).toHaveLength(serverBodies.length);
  });

  it("échecs qui ne dépendent JAMAIS de l'existence du compte (429, réseau) : pas de faux succès, message d'erreur, formulaire conservé", async () => {
    render(<ForgotPasswordPage />);
    fill("demo", "alix@demo.clientia.app");

    post.mockRejectedValueOnce(new ApiError(429, "Trop de requêtes, réessayez plus tard"));
    submit();
    expect(await screen.findByText("Trop de requêtes, réessayez plus tard")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    submit();
    expect(await screen.findByText("Une erreur est survenue.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("alix@demo.clientia.app"); // l'utilisateur peut réessayer
  });
});
