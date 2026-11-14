import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }));

describe("LandingPage (v2)", () => {
  it("porte la proposition de valeur, mène à /login, et ne propose aucune inscription", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1, name: /Transformez vos appels en rendez-vous/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /inscri|créer un compte/i })).not.toBeInTheDocument();
    // Chaque ancre de l'en-tête vise une section qui existe.
    for (const a of screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.startsWith("#") && l.getAttribute("href") !== "#")) {
      expect(document.querySelector(a.getAttribute("href")!)).not.toBeNull();
    }
  });

  it("éditeur de statut : le libellé saisi et la règle de rappel se répercutent dans l'aperçu", () => {
    render(<LandingPage />);
    fireEvent.change(screen.getByLabelText("Libellé"), { target: { value: "Relance" } });
    expect(screen.getByText(/l'agent doit fixer une date de rappel/)).toHaveTextContent("Relance");
    fireEvent.click(screen.getByRole("switch", { name: "Nécessite une date de rappel" }));
    expect(screen.getByText(/se choisit sans date de rappel/)).toBeInTheDocument();
  });

  it("rôles : l'onglet choisi change la navigation affichée", () => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Administrateur" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Rôles & permissions");
  });
});
