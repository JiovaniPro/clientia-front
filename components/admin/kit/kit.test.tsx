import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminFeedback } from "./Feedback";
import { FilterChip, SearchField, Segmented } from "./Controls";
import { RowMenu } from "./RowMenu";
import { Switch } from "./Switch";

afterEach(() => vi.useRealTimers());

describe("Switch", () => {
  it("expose son état, bascule au clic, et ne réagit pas quand il est désactivé", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch checked label="Compte de Camille" onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Compte de Camille" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(<Switch checked={false} label="Compte de Camille" onChange={onChange} disabled title="Raison" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("RowMenu", () => {
  const items = (onEdit = vi.fn(), onDelete = vi.fn()) => [
    { label: "Modifier", onSelect: onEdit },
    { label: "Supprimer", onSelect: onDelete, danger: true, disabled: true, hint: "Rôle encore utilisé" },
  ];

  it("s'ouvre, laisse le focus sur la première action, se ferme à Échap en rendant le focus au bouton", () => {
    render(<RowMenu label="Actions" items={items()} />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Modifier" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("une action choisie s'exécute et ferme le menu ; une action indisponible reste grisée avec sa raison", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<RowMenu label="Actions" items={items(onEdit, onDelete)} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    const remove = screen.getByRole("menuitem", { name: "Supprimer" });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute("title", "Rôle encore utilisé");
    fireEvent.click(remove);
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("menuitem", { name: "Modifier" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("un clic ailleurs le ferme", () => {
    render(
      <div>
        <RowMenu label="Actions" items={items()} />
        <p>ailleurs</p>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.mouseDown(screen.getByText("ailleurs"));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("AdminFeedback", () => {
  it("une confirmation disparaît seule au bout de 5 s ; une erreur reste jusqu'à sa fermeture", () => {
    vi.useFakeTimers();
    const onDismissNotice = vi.fn();
    const onDismissError = vi.fn();
    render(<AdminFeedback notice="Rôle créé." error="Échec" onDismissNotice={onDismissNotice} onDismissError={onDismissError} />);
    expect(screen.getByRole("status")).toHaveTextContent("Rôle créé.");
    expect(screen.getByRole("alert")).toHaveTextContent("Échec");

    act(() => vi.advanceTimersByTime(4900));
    expect(onDismissNotice).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
    expect(onDismissError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Fermer le message d'erreur" }));
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it("un nouveau rendu du parent ne relance pas le décompte", () => {
    vi.useFakeTimers();
    const onDismissNotice = vi.fn();
    const { rerender } = render(<AdminFeedback notice="Ok" error={null} onDismissNotice={onDismissNotice} onDismissError={() => {}} />);
    act(() => vi.advanceTimersByTime(3000));
    rerender(<AdminFeedback notice="Ok" error={null} onDismissNotice={() => onDismissNotice()} onDismissError={() => {}} />);
    act(() => vi.advanceTimersByTime(2100));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
  });
});

describe("Controls", () => {
  it("recherche : saisie, croix et Échap effacent", () => {
    const onChange = vi.fn();
    render(<SearchField value="abc" onChange={onChange} label="Rechercher" placeholder="…" />);
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Rechercher" }), { key: "Escape" });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("puce et choix exclusif : état annoncé (aria-pressed) et rappel au clic", () => {
    const onChip = vi.fn();
    const onSeg = vi.fn();
    render(
      <>
        <FilterChip label="Admin" count={2} active onClick={onChip} />
        <Segmented label="Statut" value="all" onChange={onSeg} options={[{ value: "all", label: "Tous" }, { value: "active", label: "Actifs", count: 5 }]} />
      </>,
    );
    expect(screen.getByRole("button", { name: /Admin/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Actifs/ }));
    expect(onSeg).toHaveBeenCalledWith("active");
    fireEvent.click(screen.getByRole("button", { name: /Admin/ }));
    expect(onChip).toHaveBeenCalled();
  });
});
