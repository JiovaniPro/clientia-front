import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { CallDTO } from "@/lib/api/calls";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { CreateClientDossierModal } from "./CreateClientDossierModal";
import { QualifyCallModal } from "./QualifyCallModal";

/** §6.25 lot C — garde sur la qualification et sur la création de dossier, et bascule entre les deux. */
const push = vi.fn();
const changeCallStatus = vi.fn();
const createClientDossier = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/calls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/calls")>()),
  changeCallStatus: (...a: unknown[]) => changeCallStatus(...a),
}));
vi.mock("@/lib/api/clients", () => ({ createClientDossier: (...a: unknown[]) => createClientDossier(...a) }));
vi.mock("@/lib/api/configurableLists", () => ({
  getConfigurableList: vi.fn().mockResolvedValue([
    { id: "c1", key: "FR", label: "France", isDefault: true },
    { id: "c2", key: "BE", label: "Belgique", isDefault: false },
  ]),
}));
vi.mock("@/lib/api/users", () => ({
  listUsers: vi.fn().mockResolvedValue([{ id: "a1", firstName: "Alix", lastName: "Agent", email: "a@x.fr" }]),
}));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve().then(() => fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

const GUARD_TITLE = "Modifications non enregistrées";
const CALL = { id: "call1", toNumber: "+33600000001", firstName: "Alice", lastName: "Martin", status: { key: "NOUVEAU" } } as unknown as CallDTO;
const STATUSES = [
  { id: "s1", key: "NOUVEAU", label: "Nouveau", metadata: {} },
  { id: "s2", key: "RDV", label: "RDV à planifier", metadata: { triggersClientDossierCreation: true } },
] as unknown as ConfigurableListItemDTO[];

const closeWithX = () => fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
const dossierLoaded = async () => {
  await screen.findByRole("option", { name: "France" });
  await vi.waitFor(() => expect(screen.getByLabelText("Agent RDV")).toHaveValue("a1"));
};

function renderQualify() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<QualifyCallModal call={CALL} statuses={STATUSES} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

async function goToDossierStep() {
  changeCallStatus.mockRejectedValueOnce(new ApiError(409, "Dossier requis", { code: "CLIENT_DOSSIER_REQUIRED" }));
  fireEvent.change(screen.getByLabelText("Statut"), { target: { value: "RDV" } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await screen.findByText("Créer le dossier client");
  await dossierLoaded();
}

beforeEach(() => {
  push.mockReset();
  changeCallStatus.mockReset();
  createClientDossier.mockReset();
});

describe("§6.25 lot C — CreateClientDossierModal seule", () => {
  it("non modifiée, après pré-sélection asynchrone du pays et de l'agent : fermeture directe (pas de faux positif)", async () => {
    const onClose = vi.fn();
    render(<CreateClientDossierModal call={CALL} onClose={onClose} onCreated={vi.fn()} />);
    await dossierLoaded();
    expect(screen.getByLabelText("Pays")).toHaveValue("FR");
    closeWithX();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
  });

  it("modifiée (nom pré-rempli depuis l'appel changé) : confirmation", async () => {
    const onClose = vi.fn();
    render(<CreateClientDossierModal call={CALL} onClose={onClose} onCreated={vi.fn()} />);
    await dossierLoaded();
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Martin-Durand" } });
    closeWithX();
    expect(screen.getByText(GUARD_TITLE)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("§6.25 lot C — QualifyCallModal seule", () => {
  it("non modifiée : fermeture directe", () => {
    const { onClose } = renderQualify();
    closeWithX();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
  });

  it("statut modifié : confirmation", () => {
    const { onClose } = renderQualify();
    fireEvent.change(screen.getByLabelText("Statut"), { target: { value: "RDV" } });
    closeWithX();
    expect(screen.getByText(GUARD_TITLE)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("§6.25 lot C — bascule qualification → dossier", () => {
  it("la bascule ne déclenche pas la confirmation et ne ferme rien", async () => {
    const { onClose } = renderQualify();
    await goToDossierStep();
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("retour par « Annuler » depuis un dossier non modifié : direct, saisie de qualification conservée, sa garde toujours active", async () => {
    const { onClose } = renderQualify();
    await goToDossierStep();

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Statut")).toHaveValue("RDV"); // état conservé

    closeWithX(); // qualification toujours modifiée par rapport à SA référence
    expect(screen.getByText(GUARD_TITLE)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("retour depuis un dossier modifié : la garde du dossier protège sa propre saisie", async () => {
    renderQualify();
    await goToDossierStep();
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Alicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByText(GUARD_TITLE)).toBeInTheDocument();
    expect(screen.getByText("Créer le dossier client")).toBeInTheDocument();
  });

  it("dossier créé : statut rejoué, onSaved, redirection calendrier — jamais la confirmation", async () => {
    const { onClose, onSaved } = renderQualify();
    await goToDossierStep();
    createClientDossier.mockResolvedValue({ id: "client1" });
    changeCallStatus.mockResolvedValue({ call: { ...CALL, status: { key: "RDV" } } });

    fireEvent.click(screen.getByRole("button", { name: "Créer et continuer" }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith("/calendar-pro?pendingClientId=client1");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(GUARD_TITLE)).not.toBeInTheDocument();
  });
});

describe("Date de rappel selon le statut", () => {
  const RECALL_STATUSES = [
    { id: "r1", key: "NE_REPOND_PAS", label: "Ne répond pas", metadata: { requiresRecallDate: true } },
    { id: "r2", key: "RAPPEL", label: "À rappeler", metadata: { requiresRecallDate: true } },
    { id: "r3", key: "OCCUPE", label: "Occupé", metadata: { requiresRecallDate: true } },
    { id: "r4", key: "REPONDEUR", label: "Répondeur", metadata: { requiresRecallDate: true } },
  ] as unknown as ConfigurableListItemDTO[];

  function renderWithStatus(statusKey: string) {
    render(<QualifyCallModal call={CALL} statuses={RECALL_STATUSES} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: statusKey } });
  }

  beforeEach(() => changeCallStatus.mockReset());

  it("« Ne répond pas » : ni date ni créneau ; enregistrable tel quel, sans date envoyée", async () => {
    changeCallStatus.mockResolvedValue({ call: { ...CALL } });
    renderWithStatus("NE_REPOND_PAS");
    expect(screen.queryByLabelText("Date de rappel")).toBeNull();
    expect(screen.queryByLabelText("Créneau")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(changeCallStatus).toHaveBeenCalledWith("call1", { statusKey: "NE_REPOND_PAS" }, "tok"));
  });

  it.each(["RAPPEL", "OCCUPE", "REPONDEUR"])("%s : date et créneau affichés, date toujours exigée", (statusKey) => {
    renderWithStatus(statusKey);
    expect(screen.getByLabelText("Date de rappel")).toBeInTheDocument();
    expect(screen.getByLabelText("Créneau")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText("Ce statut exige une date de rappel.")).toBeInTheDocument();
    expect(changeCallStatus).not.toHaveBeenCalled();
  });

  it("date saisie pour « À rappeler » puis bascule sur « Ne répond pas » : la date n'est pas envoyée", async () => {
    changeCallStatus.mockResolvedValue({ call: { ...CALL } });
    renderWithStatus("RAPPEL");
    fireEvent.change(screen.getByLabelText("Date de rappel"), { target: { value: "2026-10-09" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "NE_REPOND_PAS" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(changeCallStatus).toHaveBeenCalledWith("call1", { statusKey: "NE_REPOND_PAS" }, "tok"));
  });
});
