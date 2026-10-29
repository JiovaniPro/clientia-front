import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomFieldsSection } from "./CustomFieldsSection";

const setValues = vi.fn();
const DEFINITIONS = [
  { id: "d2", key: "budget", label: "Budget", fieldType: "NUMBER", options: null, isRequired: false, order: 2, section: null, isActive: true, entityType: "CLIENT" },
  { id: "d1", key: "source", label: "Source", fieldType: "SELECT", options: ["Salon", "Web"], isRequired: true, order: 1, section: null, isActive: true, entityType: "CLIENT" },
];

vi.mock("@/lib/api/customFields", () => ({
  SUPPORTED_ENTITY_TYPE: "CLIENT",
  listDefinitions: () => Promise.resolve(DEFINITIONS),
  getValues: vi.fn().mockResolvedValue([{ definitionId: "d2", value: 1200 }]),
  setValues: (...a: unknown[]) => setValues(...a),
}));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

describe("dossier client — champs personnalisés", () => {
  it("affiche les champs actifs avec leur valeur, exige les obligatoires, puis enregistre", async () => {
    render(<CustomFieldsSection clientId="c1" />);

    expect(await screen.findByLabelText("Budget")).toHaveValue(1200);
    const source = screen.getByLabelText("Source *");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Obligatoire : Source.")).toBeInTheDocument();
    expect(setValues).not.toHaveBeenCalled();

    setValues.mockResolvedValue([
      { definitionId: "d1", value: "Web" },
      { definitionId: "d2", value: 1200 },
    ]);
    fireEvent.change(source, { target: { value: "Web" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(setValues).toHaveBeenCalledWith(
        "CLIENT",
        "c1",
        [
          { definitionId: "d1", value: "Web" },
          { definitionId: "d2", value: 1200 },
        ],
        "tok",
      ),
    );
    expect(await screen.findByText("Informations complémentaires mises à jour.")).toBeInTheDocument();
  });
});
