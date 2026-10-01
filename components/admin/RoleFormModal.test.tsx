import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PermissionDTO, RoleDetailDTO } from "@/lib/api/roles";
import { RoleFormModal } from "./RoleFormModal";

const updateRole = vi.fn();
vi.mock("@/lib/api/roles", () => ({ createRole: vi.fn(), updateRole: (...a: unknown[]) => updateRole(...a) }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

const CATALOG = [
  { key: "calls.view", label: "Voir les appels", module: "Appels", description: null },
  { key: "calls.create", label: "Créer un appel", module: "Appels", description: null },
] as unknown as PermissionDTO[];
const ROLE = {
  id: "r1", name: "Calliste", description: "", color: "#2f6f4f", isSystem: false,
  permissions: [{ permission: { key: "calls.view" } }],
} as unknown as RoleDetailDTO;

function setup() {
  const onClose = vi.fn();
  render(<RoleFormModal role={ROLE} permissionsCatalog={CATALOG} onClose={onClose} onSaved={vi.fn()} />);
  return { onClose };
}

const GUARD_TITLE = "Modifications non enregistrées";
const closeWays: Record<string, () => void> = {
  "×": () => fireEvent.click(screen.getByRole("button", { name: "Fermer" })),
  Échap: () => fireEvent.keyDown(window, { key: "Escape" }),
  fond: () => fireEvent.click(screen.getByText("Modifier le rôle").closest(".fixed") as HTMLElement),
  Annuler: () => fireEvent.click(screen.getByRole("button", { name: "Annuler" })),
};

describe("§6.25 pilote — RoleFormModal", () => {
  for (const [way, close] of Object.entries(closeWays)) {
    it(`${way} sans modification : fermeture directe`, () => {
      const { onClose } = setup();
      close();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
    });

    it(`${way} après modification : confirmation, pas de fermeture`, () => {
      const { onClose } = setup();
      fireEvent.click(screen.getByLabelText("Créer un appel"));
      close();
      expect(screen.getByText(GUARD_TITLE)).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  }

  it("modification annulée à la main (case recochée) : fermeture directe", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText("Voir les appels"));
    fireEvent.click(screen.getByLabelText("Voir les appels"));
    closeWays["×"]();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("« Continuer la modification » et Échap sur la confirmation gardent le formulaire ; « Quitter sans enregistrer » ferme", () => {
    const { onClose } = setup();
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Calliste senior" } });

    closeWays["×"]();
    fireEvent.click(screen.getByRole("button", { name: "Continuer la modification" }));
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nom")).toHaveValue("Calliste senior");

    closeWays["×"]();
    fireEvent.keyDown(window, { key: "Escape" }); // pile : ferme seulement la confirmation
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    closeWays["×"]();
    fireEvent.click(screen.getByRole("button", { name: "Quitter sans enregistrer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("enregistrement en cours : ×, Échap, fond et Annuler sont neutralisés", () => {
    updateRole.mockReturnValue(new Promise(() => {})); // requête qui ne répond jamais
    const { onClose } = setup();
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Calliste senior" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByRole("button", { name: "Enregistrement…" })).toBeDisabled();

    for (const close of Object.values(closeWays)) close();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
  });
});
