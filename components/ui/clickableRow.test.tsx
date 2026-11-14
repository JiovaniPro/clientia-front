import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clickableRowProps } from "./clickableRow";

function Row({ onOpen, onButton }: { onOpen: () => void; onButton: () => void }) {
  return (
    <table>
      <tbody>
        <tr data-testid="row" {...clickableRowProps(onOpen)}>
          <td>Alice Martin</td>
          <td>
            <button type="button" onClick={onButton}>
              Copier
            </button>
            <select aria-label="Agent" defaultValue="a">
              <option value="a">A</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

describe("clickableRowProps", () => {
  it("clic sur la ligne et Entrée ouvrent ; clic sur un bouton ou un select de la ligne n'ouvre pas", () => {
    const onOpen = vi.fn();
    const onButton = vi.fn();
    render(<Row onOpen={onOpen} onButton={onButton} />);
    const row = screen.getByTestId("row");

    fireEvent.click(screen.getByText("Alice Martin"));
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Copier" }));
    fireEvent.click(screen.getByLabelText("Agent"));
    expect(onButton).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(2);

    // Entrée sur un élément interne (bouton focalisé) : c'est son action, pas l'ouverture de la ligne.
    fireEvent.keyDown(screen.getByRole("button", { name: "Copier" }), { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(row).toHaveAttribute("tabindex", "0");
  });
});
