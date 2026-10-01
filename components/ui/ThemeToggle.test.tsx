import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

/** Contrôle segmenté soleil / lune — option active en vert forêt, agit sur html.dark. */
afterEach(() => document.documentElement.classList.remove("dark"));

describe("ThemeToggle", () => {
  it("groupe « Thème » à deux options ; clair actif par défaut", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("group", { name: "Thème" })).toBeInTheDocument();
    const light = screen.getByRole("button", { name: "Mode clair" });
    const dark = screen.getByRole("button", { name: "Mode sombre" });
    expect(light).toHaveAttribute("aria-pressed", "true");
    expect(dark).toHaveAttribute("aria-pressed", "false");
    expect(light).toHaveClass("bg-forest-600");
    expect(dark).not.toHaveClass("bg-forest-600");
    expect(light.querySelector("svg")).not.toBeNull(); // icône, pas de texte
    expect(light.textContent).toBe("");
  });

  it("bascule vers sombre puis clair : classe .dark et option active suivent", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Mode sombre" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Mode sombre" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Mode sombre" })).toHaveClass("bg-forest-600");

    fireEvent.click(screen.getByRole("button", { name: "Mode clair" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Mode clair" })).toHaveAttribute("aria-pressed", "true");
  });

  it("état initial lu sur <html> : déjà en sombre → option sombre active (ancien bug du bouton texte)", () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Mode sombre" })).toHaveAttribute("aria-pressed", "true");
  });
});
