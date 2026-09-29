import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./page";

const post = vi.fn();
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
// Comme le vrai routeur : useSearchParams reflète l'URL COURANTE (donc aussi les replaceState).
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiClient: { post: (...args: unknown[]) => post(...args) },
}));

const openWith = (search: string, hash = "") => window.history.replaceState({ marqueur: 1 }, "", `/reset-password${search}${hash}`);

describe("/reset-password — le jeton quitte l'URL", () => {
  beforeEach(() => post.mockReset());
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("retire le jeton de l'URL après lecture (replaceState, sans recharger : même entrée d'historique, même état)", async () => {
    openWith("?token=jeton-secret-123");
    const lengthBefore = window.history.length;
    const replace = vi.spyOn(window.history, "replaceState");

    render(<ResetPasswordPage />);

    await waitFor(() => expect(window.location.search).toBe(""));
    expect(window.location.href).not.toContain("jeton-secret-123");
    expect(window.location.pathname).toBe("/reset-password");
    expect(replace).toHaveBeenCalled();
    expect(window.history.length).toBe(lengthBefore); // replaceState : aucune entrée d'historique ajoutée
    expect(window.history.state).toEqual({ marqueur: 1 }); // l'état de l'historique (routeur) est conservé
  });

  it("la page reste UTILISABLE après le nettoyage de l'URL (le jeton est gardé en mémoire) : le formulaire s'affiche et la soumission envoie le jeton d'origine", async () => {
    openWith("?token=jeton-secret-123");
    post.mockResolvedValue(undefined);

    const { rerender } = render(<ResetPasswordPage />);
    await waitFor(() => expect(window.location.search).toBe(""));
    rerender(<ResetPasswordPage />); // re-rendu APRÈS le nettoyage : useSearchParams ne contient plus le jeton

    expect(screen.queryByText(/Lien invalide/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "NouveauMotDePasse1" } });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), { target: { value: "NouveauMotDePasse1" } });
    fireEvent.click(screen.getByRole("button", { name: "Définir le mot de passe" }));

    expect(await screen.findByText(/Mot de passe défini/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/auth/reset-password/confirm", { token: "jeton-secret-123", newPassword: "NouveauMotDePasse1" });
  });

  it("ne retire QUE le jeton : les autres paramètres et le fragment sont conservés", async () => {
    openWith("?lang=fr&token=jeton-secret-123&x=1", "#haut");

    render(<ResetPasswordPage />);

    await waitFor(() => expect(window.location.search).toBe("?lang=fr&x=1"));
    expect(window.location.hash).toBe("#haut");
  });

  it("sans jeton dans l'URL : message « lien invalide » inchangé, et aucune modification de l'URL", () => {
    openWith("?lang=fr");
    const replace = vi.spyOn(window.history, "replaceState");
    replace.mockClear();

    render(<ResetPasswordPage />);

    expect(screen.getByText(/Lien invalide/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?lang=fr");
  });
});
