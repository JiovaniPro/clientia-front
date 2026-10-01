import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LANDING_NAV } from "./LandingHeader";
import { CONTACT_EMAIL, LandingPage } from "./LandingPage";

/** Landing (§5.1) — sections, ancres, appels à l'action, aucun appel API. */
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

const PRICING_TITLE = "Une tarification sur devis, adaptée à la taille et aux besoins de votre organisation.";
const section = (name: string) => screen.getByRole("heading", { level: 2, name }).closest("section")!;

describe("LandingPage", () => {
  it("sections : en-tête, accroche, aperçu, bénéfices, tarification, équipe, FAQ, contact, pied de page", () => {
    render(<LandingPage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "De l'appel au rendez-vous, sans changer d'outil." })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Aperçu de la file d'appels — données fictives." })).toBeInTheDocument();

    const benefits = section("Tout le parcours, dans un seul outil");
    expect(within(benefits).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Une file d'appels qui ne perd rien",
      "Du prospect au dossier client",
      "Un calendrier fait pour les rendez-vous",
      "Votre organisation, vos règles",
    ]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Tout le parcours, dans un seul outil",
      PRICING_TITLE,
      "Ce qu'en dit l'équipe",
      "Questions fréquentes",
      "Parlons de votre organisation.",
    ]);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(`© ${new Date().getFullYear()} CLIENTIA`);
  });

  it("liens : connexion vers /login, ancres internes, contact en mailto ; aucun lien d'inscription", () => {
    render(<LandingPage />);
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Demander un devis" })).toHaveAttribute("href", "#contact");
    expect(screen.getByRole("link", { name: "Nous écrire" })).toHaveAttribute("href", `mailto:${CONTACT_EMAIL}`);

    const hrefs = new Set(screen.getAllByRole("link").map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(new Set(["/", "/login", "#contact", `mailto:${CONTACT_EMAIL}`, ...LANDING_NAV.map((n) => n.href)]));
    // Aucun LIEN d'inscription (la FAQ peut, elle, dire qu'il n'y a pas d'inscription publique).
    expect(screen.queryByRole("link", { name: /inscri|créer une organisation/i })).not.toBeInTheDocument();
  });

  it("navigation : 4 ancres, chacune vers une cible qui existe dans la page", () => {
    render(<LandingPage />);
    const nav = screen.getByRole("navigation", { name: "Sections de la page" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Prospection", "Téléphonique", "Prise de rendez-vous", "Agenda partagé"]);
    expect(document.getElementById("prospection")).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(document.getElementById("telephonique")).toHaveTextContent("Une file d'appels qui ne perd rien");
    expect(document.getElementById("rendez-vous")).toHaveTextContent("Du prospect au dossier client");
    expect(document.getElementById("agenda")).toHaveTextContent("Un calendrier fait pour les rendez-vous");
    expect(document.getElementById("contact")).toBe(section("Parlons de votre organisation."));
  });

  it("interrupteur de thème (propre à la landing) : role switch, bascule html.dark", () => {
    render(<LandingPage />);
    const sw = screen.getByRole("switch", { name: "Mode sombre" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(document.documentElement).toHaveClass("dark");
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.queryByRole("group", { name: "Thème" })).not.toBeInTheDocument(); // pas le contrôle segmenté de l'app
  });

  it("héros : un seul bouton ; composition en 3 cartes (appel en cours, file, aujourd'hui), non interactive, sans grille calendrier", () => {
    render(<LandingPage />);
    const preview = screen.getByRole("figure", { name: /Aperçu de la file d'appels/ });
    expect(preview.querySelector("[inert]")).not.toBeNull();
    expect(within(preview).getByText("Appel en cours")).toBeInTheDocument();
    expect(within(preview).getByText("02:14")).toBeInTheDocument();
    expect(within(preview).getByText("File d'attente")).toBeInTheDocument();
    expect(within(preview).getByText("RDV pris")).toBeInTheDocument(); // StatusBadge réel, statut par défaut
    expect(within(preview).getAllByText("V-3")).toHaveLength(2); // WaveBadge réel
    expect(within(preview).getByText("Aujourd'hui")).toBeInTheDocument();
    expect(within(preview).getAllByText("Rendez-vous")).toHaveLength(2); // TYPE_LABEL du calendrier
    expect(within(preview).getByText("Réunion")).toBeInTheDocument();
    expect(within(preview).queryByText("07:00")).not.toBeInTheDocument(); // plus de CalendarGrid
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).getAllByRole("link").map((a) => a.textContent)).toEqual(["Se connecter"]);
  });

  it("bénéfices : numérotés 01 à 04, chacun avec son icône", () => {
    render(<LandingPage />);
    const cards = within(section("Tout le parcours, dans un seul outil")).getAllByRole("listitem");
    expect(cards.map((li) => li.querySelector("span[aria-hidden]")?.textContent)).toEqual(["01", "02", "03", "04"]);
    for (const card of cards) expect(card.querySelector("svg")).not.toBeNull();
  });

  it("tarification : sur devis, aucun prix affiché", () => {
    render(<LandingPage />);
    const pricing = section(PRICING_TITLE);
    expect(pricing.textContent).not.toMatch(/\d|€|CHF|\/ ?mois/);
    expect(within(pricing).getByRole("link", { name: "Demander un devis" })).toHaveAttribute("href", "#contact");
  });

  it("équipe : 3 citations signées « L'équipe CLIENTIA » + rôle, jamais des clients", () => {
    render(<LandingPage />);
    const team = section("Ce qu'en dit l'équipe");
    const figures = within(team).getAllByRole("figure");
    expect(figures).toHaveLength(3);
    expect(figures.map((f) => f.querySelector("figcaption")?.textContent)).toEqual([
      "CPL'équipe CLIENTIAConception produit",
      "DVL'équipe CLIENTIADéveloppement",
      "CPL'équipe CLIENTIAConception produit",
    ]);
    expect(team.textContent).not.toMatch(/client(e)?s? (dit|disent|témoign)|nos clients/i);
  });

  it("FAQ : 6 questions en accordéon natif, fermées par défaut, ouvertes au clic", () => {
    render(<LandingPage />);
    const items = section("Questions fréquentes").querySelectorAll("details");
    expect(items).toHaveLength(6);
    expect([...items].every((d) => !d.open)).toBe(true);
    const first = items[0]!;
    expect(first.querySelector("summary")).toHaveTextContent("Comment obtenir un accès ?");
    fireEvent.click(first.querySelector("summary")!);
    expect(first.open).toBe(true);
    expect(first).toHaveTextContent("sur invitation");
  });

  it("aucun appel réseau au rendu (pas d'API, pas de connexion requise ; le contact est un mailto:)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<LandingPage />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
