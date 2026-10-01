import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteOrganizationModal } from "./DeleteOrganizationModal";

function setup() {
  const onConfirm = vi.fn();
  render(<DeleteOrganizationModal organizationName="Cabinet Rochat" userCount={3} onConfirm={onConfirm} onClose={vi.fn()} />);
  const input = screen.getByLabelText("Tapez « Cabinet Rochat » pour confirmer");
  const button = screen.getByRole("button", { name: "Supprimer définitivement" });
  return { onConfirm, input, button };
}

describe("DeleteOrganizationModal — confirmation par nom exact", () => {
  it("bouton désactivé tant que la saisie ne correspond pas exactement", () => {
    const { input, button, onConfirm } = setup();
    expect(button).toBeDisabled();
    for (const wrong of ["cabinet rochat", "Cabinet Rochat ", "Cabinet", " Cabinet Rochat"]) {
      fireEvent.change(input, { target: { value: wrong } });
      expect(button).toBeDisabled();
    }
    fireEvent.submit(button.closest("form")!);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("saisie exacte → bouton activé et confirmation transmise", () => {
    const { input, button, onConfirm } = setup();
    fireEvent.change(input, { target: { value: "Cabinet Rochat" } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith("Cabinet Rochat");
  });
});
