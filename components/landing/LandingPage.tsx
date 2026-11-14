import { Mail, Plus } from "lucide-react";
import { displayFont } from "@/components/brand/displayFont";
import { CopyEmail } from "./CopyEmail";
import { Hero } from "./Hero";
import { HeroDemo } from "./HeroDemo";
import { Journey } from "./Journey";
import { LandingHeader } from "./LandingHeader";
import { Reveal } from "./motion";
import { RolesTabs } from "./RolesTabs";
import { RulesPlayground } from "./RulesPlayground";
import "./landing.css";

/**
 * Landing §5.1 (v2). Héros en panneau encadré (Hero), puis la fenêtre produit qui joue seule le parcours
 * (HeroDemo), parcours épinglé en quatre étapes (Journey), rôles en onglets (RolesTabs),
 * éditeur de statut jouable (RulesPlayground), FAQ, contact. Aucun appel API ; pas de lien
 * d'inscription (fermée). Version précédente : _quarantaine/landing-v1-2026-11-12/.
 */

// ponytail: adresse provisoire, à confirmer avant mise en ligne.
export const CONTACT_EMAIL = "contact@clientia.app";

const CONTAINER = "mx-auto max-w-7xl px-4 sm:px-8";
const H2 = "font-display text-[1.7rem] leading-[1.12] text-ink [text-wrap:balance] sm:text-4xl";

/** Garanties de la plateforme : des faits d'architecture, pas des promesses. */
const GUARANTEES = [
  { title: "Un espace par organisation", text: "Utilisateurs, appels, dossiers et rendez-vous ne sont jamais visibles depuis une autre organisation." },
  { title: "Des permissions à la carte", text: "Partez des trois rôles fournis ou créez les vôtres, permission par permission." },
  { title: "Un journal d'audit", text: "Les actions sensibles sont enregistrées : qui a fait quoi, et quand." },
];

/** Uniquement des faits du produit tel qu'il est construit. */
const FAQ = [
  {
    q: "Comment obtenir un accès ?",
    a: "L'accès se fait sur invitation : l'administrateur de votre organisation crée votre compte et vous attribue un rôle. Il n'y a pas d'inscription publique.",
  },
  {
    q: "Puis-je configurer mes propres statuts et champs ?",
    a: "Oui. Les statuts d'appel, de dossier et les autres listes sont configurables par votre administrateur, qui peut aussi ajouter des champs personnalisés au dossier client.",
  },
  {
    q: "Qui décide de ce que chaque utilisateur peut faire ?",
    a: "Votre administrateur. Il ajuste les rôles fournis par défaut (Administrateur, Agent calliste, Agent RDV) ou en crée de nouveaux, avec les permissions de son choix.",
  },
  {
    q: "Le calendrier est-il partagé entre agents ?",
    a: "Oui. Les agents partagent les calendriers communs de l'organisation et voient les rendez-vous qui les concernent ; les administrateurs disposent d'une vue d'ensemble.",
  },
  {
    q: "Peut-on déléguer un rendez-vous ?",
    a: "Oui. Un rendez-vous en attente ou confirmé peut être transmis à un autre agent, qui le confirme ou le refuse. S'il le refuse, le rendez-vous revient automatiquement à la personne qui le lui avait transmis, et chaque étape reste tracée.",
  },
  {
    q: "Mes données sont-elles isolées des autres organisations ?",
    a: "Oui. Chaque organisation dispose de son propre espace : ses utilisateurs, appels, dossiers et rendez-vous ne sont jamais visibles depuis une autre organisation.",
  },
];

const ON_DEEP_BUTTON =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--lp-on-deep)] px-6 text-sm font-semibold text-[var(--lp-deep)] transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-on-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lp-deep)]";

export function LandingPage() {
  return (
    <div data-landing className={`${displayFont.variable} flex min-h-screen flex-col bg-cream`}>
      <LandingHeader />
      <main className="flex-1">
        <Hero />

        <section aria-labelledby="demo-title">
          <div className={`${CONTAINER} pb-4 pt-12 lg:pt-16`}>
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 id="demo-title" className={H2}>
                Regardez un appel <em className="text-forest-600">devenir un rendez-vous.</em>
              </h2>
              <p className="mt-5 text-lg text-ink-muted">Une qualification, et tout le reste suit : le dossier, l&apos;agent, la confirmation.</p>
            </Reveal>
            <div className="mx-auto mt-12 max-w-5xl">
              <HeroDemo />
            </div>
          </div>
        </section>

        <section id="parcours" aria-labelledby="parcours-title" className="scroll-mt-16">
          <div className={`${CONTAINER} py-24 lg:py-32`}>
            <Reveal>
              <h2 id="parcours-title" className={`${H2} max-w-3xl`}>
                Un appel entre. <em className="text-forest-600">Un rendez-vous en sort.</em>
              </h2>
              <p className="mt-5 max-w-xl text-lg text-ink-muted">Quatre étapes, un seul outil, aucune ressaisie.</p>
            </Reveal>

            <Journey />
          </div>
        </section>

        <section id="roles" aria-labelledby="roles-title" className="scroll-mt-16 border-t border-border">
          <div className={`${CONTAINER} py-24 lg:py-32`}>
            <Reveal>
              <h2 id="roles-title" className={`${H2} max-w-3xl`}>
                Chacun son écran, <em className="text-forest-600">tous la même information.</em>
              </h2>
              <p className="mt-5 max-w-xl text-lg text-ink-muted">
                Trois rôles sont fournis dès le départ. Chacun n&apos;affiche que ce qui sert son travail.
              </p>
            </Reveal>
            <Reveal className="mt-12">
              <RolesTabs />
            </Reveal>
          </div>
        </section>

        <section id="configuration" aria-labelledby="config-title" className="scroll-mt-16 bg-forest-50">
          <div className={`${CONTAINER} py-24 lg:py-32`}>
            <div className="grid grid-cols-1 items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] [&>*]:min-w-0">
              <Reveal>
                <h2 id="config-title" className={H2}>
                  Vos statuts, vos champs, <em className="text-forest-600">vos règles.</em>
                </h2>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted [text-wrap:pretty]">
                  Rien n&apos;est figé dans le code. Renommez ce statut, changez sa couleur, décidez s&apos;il impose un
                  rappel : c&apos;est ce que fait votre administrateur, sans nous appeler.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <RulesPlayground />
              </Reveal>
            </div>

            <dl className="mt-20 grid grid-cols-1 gap-x-12 gap-y-10 border-t border-forest-600/25 pt-12 md:grid-cols-3">
              {GUARANTEES.map((g, i) => (
                <Reveal key={g.title} delay={i * 110}>
                  <dt className="font-display text-2xl font-semibold text-ink">{g.title}</dt>
                  <dd className="mt-3 max-w-sm text-base leading-relaxed text-ink-muted">{g.text}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        <section id="questions" aria-labelledby="faq-title" className="scroll-mt-16">
          <div className={`${CONTAINER} grid grid-cols-1 gap-x-16 gap-y-10 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:py-32`}>
            <Reveal>
              <h2 id="faq-title" className={H2}>
                Questions <em className="text-forest-600">fréquentes</em>
              </h2>
              <p className="mt-6 max-w-xs text-base leading-relaxed text-ink-muted">
                Une autre question ?{" "}
                <a
                  href="#contact"
                  className="rounded-sm font-medium text-ink underline decoration-forest-600 decoration-2 underline-offset-4 transition-colors duration-150 hover:text-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  Écrivez-nous
                </a>
                .
              </p>
            </Reveal>
            <div className="border-t border-border">
              {FAQ.map((item) => (
                <details key={item.q} className="lp-faq group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-semibold text-ink transition-colors duration-150 hover:text-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Plus aria-hidden strokeWidth={1.5} className="h-5 w-5 shrink-0 text-forest-600 transition-transform duration-300 group-open:rotate-45" />
                  </summary>
                  <p className="max-w-2xl pb-7 pr-10 text-base leading-relaxed text-ink-muted [text-wrap:pretty]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" aria-labelledby="contact-title" className="scroll-mt-16 bg-[var(--lp-deep)] text-[var(--lp-on-deep)]">
          <div className={`${CONTAINER} py-24 lg:py-32`}>
            <Reveal>
              <h2 id="contact-title" className="max-w-4xl font-display text-[clamp(1.7rem,4.4vw,3.5rem)] leading-[1.1] [text-wrap:balance]">
                Parlons de <em className="text-[var(--lp-ember)]">votre organisation.</em>
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--lp-on-deep-muted)]">
                La tarification se fait sur devis, selon le nombre d&apos;utilisateurs et votre façon de travailler. Une
                question, une démonstration ? Écrivez-nous.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
                <a href={`mailto:${CONTACT_EMAIL}`} className={ON_DEEP_BUTTON}>
                  <Mail aria-hidden strokeWidth={1.5} className="h-4 w-4" />
                  Nous écrire
                </a>
                <CopyEmail email={CONTACT_EMAIL} />
              </div>
            </Reveal>
          </div>
          <footer className="border-t border-[var(--lp-on-deep-line)]">
            <div className={`${CONTAINER} flex items-center justify-between py-6 font-mono text-xs text-[var(--lp-on-deep-muted)]`}>
              <span>© {new Date().getFullYear()} CLIENTIA</span>
              <a href="#" className="rounded-sm hover:text-[var(--lp-on-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-on-deep)]">
                Haut de page
              </a>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
