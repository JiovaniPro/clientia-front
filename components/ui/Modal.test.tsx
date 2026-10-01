import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmModal } from "./ConfirmModal";
import { Modal } from "./Modal";

const escape = () => fireEvent.keyDown(window, { key: "Escape" });

describe("§6.25 lot 0 — Modal", () => {
  it("Échap sur une confirmation empilée ne ferme que la confirmation (cas EventPanel → Supprimer)", () => {
    const closeForm = vi.fn();
    const closeConfirm = vi.fn();
    const { rerender } = render(
      <Modal title="Modifier l'événement" onClose={closeForm}>
        formulaire
      </Modal>,
    );
    // Même structure qu'EventPanel : la confirmation apparaît ensuite, en frère de la modale.
    rerender(
      <>
        <Modal title="Modifier l'événement" onClose={closeForm}>
          formulaire
        </Modal>
        <ConfirmModal title="Supprimer cet événement" message="…" confirmLabel="Supprimer" onConfirm={vi.fn()} onClose={closeConfirm} />
      </>,
    );
    escape();
    expect(closeConfirm).toHaveBeenCalledTimes(1);
    expect(closeForm).not.toHaveBeenCalled();

    // Confirmation fermée -> la modale du dessous redevient la plus haute.
    rerender(
      <Modal title="Modifier l'événement" onClose={closeForm}>
        formulaire
      </Modal>,
    );
    escape();
    expect(closeForm).toHaveBeenCalledTimes(1);
  });

  it("closeDisabled neutralise ×, Échap et clic sur le fond", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal title="T" onClose={onClose} closeDisabled>
        contenu
      </Modal>,
    );
    const closeButton = screen.getByRole("button", { name: "Fermer" });
    const backdrop = screen.getByText("T").closest(".fixed") as HTMLElement;

    expect(closeButton).toBeDisabled();
    fireEvent.click(closeButton);
    escape();
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal title="T" onClose={onClose}>
        contenu
      </Modal>,
    );
    fireEvent.click(closeButton);
    escape();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("ConfirmModal en cours de confirmation ne se ferme pas", () => {
    const onClose = vi.fn();
    render(<ConfirmModal title="T" message="m" confirmLabel="OK" onConfirm={vi.fn()} onClose={onClose} isConfirming />);
    escape();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
