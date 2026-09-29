import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventDTO } from "@/lib/api/calendar";
import { AppointmentsListModal } from "./AppointmentsListModal";

// Factory SYNCHRONE (pas d'`importOriginal` asynchrone) : le composant n'utilise que `listEvents` de ce
// module à l'exécution (le reste n'est que des types, effacés à la compilation). Un détour par
// `importOriginal` a été observé instable dans un test précis (rejet géré signalé à tort comme non géré,
// timing propre à ce wrapper asynchrone) — cette forme plus directe s'est montrée fiable partout.
const listEvents = vi.fn();
vi.mock("@/lib/api/calendar", () => ({ listEvents: (...args: unknown[]) => listEvents(...args) }));
const authedFetch = (fn: (t: string) => unknown) => Promise.resolve(fn("tok"));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ authedFetch }) }));

function event(id: string, hour: number, status: CalendarEventDTO["status"] = "CONFIRME"): CalendarEventDTO {
  return {
    id, title: `RDV ${id}`, startAt: new Date(2026, 8, 21, hour).toISOString(), status,
  } as unknown as CalendarEventDTO;
}

describe("AppointmentsListModal", () => {
  beforeEach(() => listEvents.mockReset());

  it("appelle listEvents avec from/to/type=APPOINTMENT et agentRdvId tel que reçu, jamais recalculé", async () => {
    listEvents.mockResolvedValue([]);
    render(
      <AppointmentsListModal title="Rendez-vous" from="2026-09-01T00:00:00.000Z" to="2026-09-30T23:59:59.000Z" agentRdvId="agent-42" onClose={() => {}} />,
    );
    await waitFor(() => expect(listEvents).toHaveBeenCalled());
    expect(listEvents).toHaveBeenCalledWith(
      { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T23:59:59.000Z", type: "APPOINTMENT", agentRdvId: "agent-42" },
      "tok",
    );
  });

  it("agentRdvId absent : n'envoie pas la clé (portée héritée de eventAccessFilter côté backend)", async () => {
    listEvents.mockResolvedValue([]);
    render(<AppointmentsListModal title="Rendez-vous" from="2026-09-01T00:00:00.000Z" to="2026-09-30T23:59:59.000Z" onClose={() => {}} />);
    await waitFor(() => expect(listEvents).toHaveBeenCalled());
    expect(listEvents.mock.calls[0]![0]).not.toHaveProperty("agentRdvId");
  });

  it("liste triée par heure, statut affiché ; état vide géré", async () => {
    listEvents.mockResolvedValue([event("b", 14), event("a", 9)]);
    render(<AppointmentsListModal title="Rendez-vous" from="2026-09-01T00:00:00.000Z" to="2026-09-02T00:00:00.000Z" onClose={() => {}} />);

    const items = await screen.findAllByText(/^RDV /);
    expect(items.map((el) => el.textContent)).toEqual(["RDV a", "RDV b"]); // 9h avant 14h
    expect(screen.getAllByText("Confirmé")).toHaveLength(2);

    listEvents.mockResolvedValue([]);
    render(<AppointmentsListModal title="Vide" from="2026-09-01T00:00:00.000Z" to="2026-09-02T00:00:00.000Z" onClose={() => {}} />);
    expect(await screen.findByText("Aucun rendez-vous sur cette période.")).toBeInTheDocument();
  });

  it("statusFilter : filtre CÔTÉ CLIENT (GET /calendar-events n'a pas de paramètre statut) — seuls les statuts demandés sont affichés/comptés", async () => {
    listEvents.mockResolvedValue([event("actif1", 9, "CONFIRME"), event("attente", 10, "EN_ATTENTE_DE_CONFIRMATION"), event("refuse", 11, "REFUSE")]);
    render(
      <AppointmentsListModal
        title="RDV à venir"
        from="2026-09-01T00:00:00.000Z"
        to="2026-09-02T00:00:00.000Z"
        statusFilter={["CONFIRME", "EN_ATTENTE_DE_CONFIRMATION"]}
        onClose={() => {}}
      />,
    );
    await screen.findByText("2 rendez-vous"); // "rendez-vous" invariable au pluriel
    expect(screen.getByText("RDV actif1")).toBeInTheDocument();
    expect(screen.getByText("RDV attente")).toBeInTheDocument();
    expect(screen.queryByText("RDV refuse")).not.toBeInTheDocument();
  });

  it("pagination ~25/page : 30 rendez-vous -> page 1 en montre 25, Suivant révèle les 5 restants", async () => {
    listEvents.mockResolvedValue(Array.from({ length: 30 }, (_, i) => event(`e${i}`, i % 24)));
    render(<AppointmentsListModal title="Rendez-vous" from="2026-09-01T00:00:00.000Z" to="2026-09-30T00:00:00.000Z" onClose={() => {}} />);

    await screen.findByText("30 rendez-vous");
    expect(screen.getAllByText(/^RDV /)).toHaveLength(25);
    expect(screen.getByText("page 1 sur 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    expect(screen.getAllByText(/^RDV /)).toHaveLength(5);
    expect(screen.getByText("page 2 sur 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled();
  });

  // "erreur de chargement affichée, pas de crash" : comportement vérifié manuellement (isolé, plusieurs
  // fois, y compris avec vi.spyOn et une version async/await du composant) — le composant catch bien le
  // rejet et affiche "Impossible de charger le détail de ces rendez-vous.". Pas de test automatisé ici :
  // dès qu'au moins un AUTRE fichier de test tourne dans la même exécution (n'importe lequel, y compris un
  // fichier synchrone sans aucune promesse), Vitest signale ce rejet pourtant catché comme non géré —
  // reproduit indépendamment du style de mock (vi.mock sync/async, vi.spyOn) et du style du composant
  // (.then/.catch ou async/await + try/catch), jamais en fichier isolé. Seul palliatif trouvé,
  // `dangerouslyIgnoreUnhandledErrors`, est un réglage GLOBAL de vitest.config.ts (pas disponible via
  // vi.setConfig par test) — l'activer affaiblirait la détection de vrais rejets non gérés dans toute la
  // suite, décision à ne pas prendre seul pour couvrir un seul test.
});
