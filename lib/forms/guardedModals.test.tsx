import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { CustomFieldFormModal } from "@/components/admin/CustomFieldFormModal";
import { EmailTemplateFormModal } from "@/components/admin/EmailTemplateFormModal";
import { ListItemFormModal } from "@/components/admin/ListItemFormModal";
import { UserFormModal } from "@/components/admin/UserFormModal";
import { NewCallModal } from "@/components/calls/NewCallModal";
import { OrganizationFormModal } from "@/components/platform/OrganizationFormModal";
import { ReminderFormModal } from "@/components/reminders/ReminderFormModal";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import type { CustomFieldDefinitionDTO } from "@/lib/api/customFields";
import type { RoleListItemDTO } from "@/lib/api/roles";

/**
 * §6.25 lot B — preuve de branchement du garde sur chaque modale. Les 8 cas de
 * fermeture (×, Échap, fond, Annuler × modifié/non modifié) sont couverts une fois
 * pour toutes sur le pilote (RoleFormModal.test.tsx) : ici, × suffit.
 */
const createUser = vi.fn();
vi.mock("@/lib/api/users", () => ({ createUser: (...a: unknown[]) => createUser(...a), updateUser: vi.fn() }));
vi.mock("@/lib/api/configurableLists", () => ({ createListItem: vi.fn(), updateListItem: vi.fn() }));
vi.mock("@/lib/api/customFields", () => ({ createDefinition: vi.fn(), updateDefinition: vi.fn(), SUPPORTED_ENTITY_TYPE: "CLIENT" }));
vi.mock("@/lib/api/emails", () => ({ createTemplate: vi.fn(), updateTemplate: vi.fn() }));
vi.mock("@/lib/api/reminders", () => ({ createReminder: vi.fn(), updateReminder: vi.fn() }));
vi.mock("@/lib/api/calls", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api/calls")>()), createCall: vi.fn() }));
vi.mock("@/lib/api/platformOrganizations", () => ({ createOrganization: vi.fn() }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));
vi.mock("@/lib/auth/PlatformAuthContext", () => ({ usePlatformAuth: () => ({ authedFetch }) }));

const GUARD_TITLE = "Modifications non enregistrées";
const ROLES = [{ id: "r1", name: "Calliste" }] as unknown as RoleListItemDTO[];
const STATUSES = [{ id: "s1", key: "NOUVEAU", label: "Nouveau", isDefault: true, metadata: {} }] as unknown as ConfigurableListItemDTO[];
const SELECT_DEFINITION = {
  id: "d1", key: "SOURCE", label: "Source", fieldType: "SELECT", options: ["Salon", "Web"],
  isRequired: false, section: null, order: 0,
} as unknown as CustomFieldDefinitionDTO;

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (label: string) => fireEvent.click(screen.getByLabelText(label));

const cases: { name: string; render: (onClose: () => void) => ReactElement; modify: () => void }[] = [
  {
    name: "UserFormModal (texte : e-mail)",
    render: (onClose) => <UserFormModal roles={ROLES} onClose={onClose} onSaved={vi.fn()} />,
    modify: () => type("E-mail", "a@b.fr"),
  },
  {
    name: "ListItemFormModal (Set : comportements)",
    render: (onClose) => (
      <ListItemFormModal listKey="CALL_STATUS" behaviorFlags={[{ key: "requiresRecallDate", label: "Exige une date de rappel" }]} onClose={onClose} onSaved={vi.fn()} />
    ),
    modify: () => click("Exige une date de rappel"),
  },
  {
    name: "CustomFieldFormModal création (tableau : options)",
    render: (onClose) => <CustomFieldFormModal onClose={onClose} onSaved={vi.fn()} />,
    modify: () => {
      type("Type de champ", "SELECT");
      fireEvent.click(screen.getByRole("button", { name: "+ Ajouter une option" }));
      type("Type de champ", "TEXT"); // type revenu à l'initial : seule l'option ajoutée reste
    },
  },
  {
    name: "CustomFieldFormModal édition (tableau : option modifiée)",
    render: (onClose) => <CustomFieldFormModal definition={SELECT_DEFINITION} onClose={onClose} onSaved={vi.fn()} />,
    modify: () => fireEvent.change(screen.getByDisplayValue("Web"), { target: { value: "Web (site)" } }),
  },
  {
    name: "EmailTemplateFormModal (texte : contenu)",
    render: (onClose) => <EmailTemplateFormModal onClose={onClose} onSaved={vi.fn()} />,
    modify: () => type("Contenu", "Bonjour"),
  },
  {
    name: "ReminderFormModal (texte : titre)",
    render: (onClose) => <ReminderFormModal onClose={onClose} onSaved={vi.fn()} />,
    modify: () => type("Titre", "Rappeler M. Dupont"),
  },
  {
    name: "NewCallModal (texte : notes)",
    render: (onClose) => <NewCallModal statuses={STATUSES} onClose={onClose} onCreated={vi.fn()} />,
    modify: () => type("Notes", "Intéressé"),
  },
  {
    name: "OrganizationFormModal (texte : nom)",
    render: (onClose) => <OrganizationFormModal onClose={onClose} onSaved={vi.fn()} />,
    modify: () => type("Nom de l'organisation", "Acme"),
  },
];

const closeWithX = () => fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

describe("§6.25 lot B — garde branché sur chaque modale", () => {
  for (const { name, render: renderModal, modify } of cases) {
    it(`${name} — non modifié : fermeture directe`, () => {
      const onClose = vi.fn();
      render(renderModal(onClose));
      closeWithX();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
    });

    it(`${name} — modifié : confirmation, pas de fermeture`, () => {
      const onClose = vi.fn();
      render(renderModal(onClose));
      modify();
      closeWithX();
      expect(screen.getByText(GUARD_TITLE)).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  }

  it("CustomFieldFormModal — passer en choix unique puis revenir en texte ne déclenche rien (défaut [\"\"])", () => {
    const onClose = vi.fn();
    render(<CustomFieldFormModal onClose={onClose} onSaved={vi.fn()} />);
    type("Type de champ", "SELECT");
    type("Type de champ", "TEXT");
    closeWithX();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("enregistrement réussi : onSaved, jamais la confirmation", async () => {
    createUser.mockResolvedValue({ id: "u1" });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<UserFormModal roles={ROLES} onClose={onClose} onSaved={onSaved} />);
    type("E-mail", "a@b.fr");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
  });
});
