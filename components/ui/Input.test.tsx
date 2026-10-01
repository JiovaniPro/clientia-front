import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input — bouton œil sur les mots de passe", () => {
  it("type=password : masqué par défaut, l'œil affiche puis remasque la saisie", () => {
    render(<Input label="Mot de passe" type="password" defaultValue="secret" />);
    const field = screen.getByLabelText("Mot de passe");
    expect(field).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(field).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("autres types : aucun bouton œil", () => {
    render(<Input label="E-mail" type="email" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
