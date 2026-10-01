import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EmailTemplateDTO } from "@/lib/api/emails";
import { EmailTemplateFormModal } from "./EmailTemplateFormModal";

vi.mock("@/lib/api/emails", () => ({ createTemplate: vi.fn(), updateTemplate: vi.fn() }));
const auth = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => auth }));

const VARIABLES = ["prenom_client", "nom_client", "adresse_client", "telephone_client", "nom_organisation", "date_rdv", "heure_rdv"];

function renderWith(subject: string, body: string) {
  const template = { id: "t1", key: "k", label: "L", subject, body, isActive: true } as unknown as EmailTemplateDTO;
  render(<EmailTemplateFormModal template={template} onClose={vi.fn()} onSaved={vi.fn()} />);
  return {
    subject: screen.getByLabelText("Objet") as HTMLInputElement,
    body: screen.getByLabelText("Contenu") as HTMLTextAreaElement,
    click: (name: string) => fireEvent.click(screen.getByRole("button", { name: `{{${name}}}` })),
  };
}

describe("EmailTemplateFormModal — variables disponibles", () => {
  it("les 7 variables sont des boutons, chacun avec sa légende (restriction RDV comprise)", () => {
    renderWith("", "");
    expect(screen.getByRole("heading", { name: "Variables disponibles (objet et contenu)" })).toBeInTheDocument();
    for (const name of VARIABLES) expect(screen.getByRole("button", { name: `{{${name}}}` })).toBeInTheDocument();
    expect(screen.getByText("Prénom du client")).toBeInTheDocument();
    expect(screen.getAllByText(/vide en envoi manuel depuis un dossier/)).toHaveLength(2);
  });

  it("chaque bouton insère SA variable au curseur du contenu (champ actif par défaut)", () => {
    for (const name of VARIABLES) {
      const { body, click } = renderWith("", "Bonjour  !");
      body.focus();
      body.setSelectionRange(8, 8); // entre les deux espaces
      click(name);
      expect(body).toHaveValue(`Bonjour {{${name}}} !`);
      document.body.innerHTML = "";
    }
  });

  it("objet actif : la variable va dans l'objet, au curseur, et le contenu ne bouge pas", () => {
    const { subject, body, click } = renderWith("Votre RDV du ", "Corps");
    fireEvent.focus(subject);
    subject.setSelectionRange(13, 13);
    click("date_rdv");
    expect(subject).toHaveValue("Votre RDV du {{date_rdv}}");
    expect(body).toHaveValue("Corps");
  });

  it("une sélection est remplacée par la variable", () => {
    const { body, click } = renderWith("", "Bonjour XXX,");
    fireEvent.focus(body);
    body.setSelectionRange(8, 11); // "XXX"
    click("prenom_client");
    expect(body).toHaveValue("Bonjour {{prenom_client}},");
  });

  it("retour au contenu après l'objet : l'insertion suit le dernier champ actif", () => {
    const { subject, body, click } = renderWith("Objet", "Corps ");
    fireEvent.focus(subject);
    fireEvent.focus(body);
    body.setSelectionRange(6, 6);
    click("nom_organisation");
    expect(body).toHaveValue("Corps {{nom_organisation}}");
    expect(subject).toHaveValue("Objet");
  });
});
