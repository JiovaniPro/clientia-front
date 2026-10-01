import { ArrowRight, CalendarDays, Mail, Phone, Plus, User, Users } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { TYPE_COLOR, TYPE_LABEL } from "@/components/calendar/CalendarGrid";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * Landing §5.1 (DesignClaude.md) — héros asymétrique (texte / composition en couches :
 * appel en cours, file d'attente, agenda du jour), bénéfices numérotés, tarification sur
 * devis, parole de l'équipe, FAQ, contact. Aucun appel API : les aperçus sont composés avec
 * les vrais composants de l'app (StatusBadge, WaveBadge, couleurs/libellés du calendrier)
 * et des données fictives écrites en dur ; le contact est un simple mailto:. Pas de lien
 * d'inscription (fermée), pas de mentions légales / société tant qu'elles ne sont pas fournies.
 *
 * Contrastes vérifiés (WCAG) : accroche terracotta-600 en clair (5.0:1) / 500 en sombre
 * (4.5:1) ; numéros en grand corps terracotta-500 (≥ 4.0:1) ; boutons pleins : texte en
 * encre sombre en mode sombre (le blanc sur #3FA383 n'atteint que 3.1:1) ; bloc contact
 * en vert forêt fixe #1F6F54 dans les deux thèmes, texte blanc (6.1:1).
 */

// ponytail: adresse provisoire, à confirmer par Jiovani avant mise en ligne.
export const CONTACT_EMAIL = "contact@clientia.app";

const BUTTON_BASE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-forest-600 text-white hover:bg-forest-700 focus-visible:ring-forest-600 focus-visible:ring-offset-cream dark:text-cream`;
const KICKER = "font-mono text-xs font-medium uppercase tracking-wider text-terracotta-600 dark:text-terracotta-500";
const SECTION = "border-t border-border";
const CONTAINER = "mx-auto max-w-7xl px-4 sm:px-8";
const H2 = "font-display text-3xl font-semibold leading-tight text-ink [text-wrap:balance] sm:text-4xl";
const CARD = "rounded-lg border border-border bg-surface shadow-flat";

/** Statuts et couleurs = contenu par défaut d'une organisation (backend organizations/defaultData.ts). */
const PREVIEW_CALLS = [
  { name: "Camille Rochat", phone: "+41 79 482 15 36", status: "À rappeler", color: "#D97706", wave: 3 },
  { name: "Julien Moreau", phone: "+33 6 12 48 93 07", status: "RDV pris", color: "#16A34A", wave: 3 },
  { name: "Nadia Keller", phone: "+41 78 603 22 91", status: "Ne répond pas", color: "#D97706", wave: 2 },
  { name: "Thomas Girard", phone: "+33 7 81 34 56 20", status: "À contacter", color: "#6B7280", wave: 4 },
  { name: "Léa Bonvin", phone: "+41 76 215 88 40", status: "Répondeur", color: "#D97706", wave: 2 },
  { name: "Antoine Lefèvre", phone: "+33 6 45 09 71 18", status: "Pas intéressé", color: "#DC2626", wave: 1 },
];

const TODAY = [
  { time: "09:00", type: "APPOINTMENT", who: "Luca Bernasconi" },
  { time: "10:30", type: "APPOINTMENT", who: "Élodie Favre" },
  { time: "14:00", type: "MEETING", who: "Point équipe" },
] as const;

/** Hauteurs relatives des barres de l'onde sonore (carte « Appel en cours »). */
const WAVE = [0.35, 0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.8, 0.55, 0.3, 0.65, 0.45];

/** `id` = cibles des ancres de l'en-tête (LANDING_NAV) : Téléphonique, Prise de rendez-vous, Agenda partagé. */
const BENEFITS: { id?: string; icon: LucideIcon; title: string; text: string }[] = [
  {
    id: "telephonique",
    icon: Phone,
    title: "Une file d'appels qui ne perd rien",
    text: "Importez vos listes et qualifiez chaque appel en un clic. Aucun rappel n'est oublié.",
  },
  {
    id: "rendez-vous",
    icon: User,
    title: "Du prospect au dossier client",
    text: "Un appel qui aboutit crée le dossier client et l'assigne à un agent RDV.",
  },
  {
    id: "agenda",
    icon: CalendarDays,
    title: "Un calendrier fait pour les rendez-vous",
    text: "Confirmation, délégation, suivi honoré ou manqué, e-mails au client.",
  },
  {
    icon: Users,
    title: "Votre organisation, vos règles",
    text: "Un espace isolé, des rôles à la carte, des statuts et des champs à votre main.",
  },
];

/** Perspective interne (l'équipe qui construit CLIENTIA) — jamais présentée comme des avis clients. */
const TEAM_QUOTES = [
  {
    quote:
      "Un appel qui aboutit ne doit jamais se perdre entre deux écrans. C'est pour ça que le dossier client naît directement de la qualification de l'appel.",
    role: "Conception produit",
    initials: "CP",
  },
  {
    quote:
      "Chaque organisation a ses propres statuts. Plutôt que de les figer dans le code, nous les avons rendus configurables dès le premier jour.",
    role: "Développement",
    initials: "DV",
  },
  {
    quote:
      "Déléguer un rendez-vous, c'est laisser une trace : qui l'a transmis, à qui, et à qui il revient s'il est refusé.",
    role: "Conception produit",
    initials: "CP",
  },
];

/** Uniquement des faits du produit tel qu'il est construit — rien de promis au-delà. */
const FAQ = [
  {
    q: "Comment obtenir un accès ?",
    a: "L'accès se fait sur invitation : l'administrateur de votre organisation crée votre compte et vous attribue un rôle. Il n'y a pas d'inscription publique.",
  },
  {
    q: "Puis-je configurer mes propres statuts et champs ?",
    a: "Oui. Les statuts d'appel, de dossier et les autres listes déroulantes sont configurables par votre administrateur, qui peut aussi ajouter des champs personnalisés au dossier client.",
  },
  {
    q: "Qui décide de ce que chaque utilisateur peut faire ?",
    a: "Votre administrateur. Il ajuste les rôles fournis par défaut (Administrateur, Agent calliste, Agent RDV) ou en crée de nouveaux, avec les permissions de son choix.",
  },
  {
    q: "Le calendrier est-il partagé entre agents ?",
    a: "Oui. Les agents partagent les calendriers communs de l'organisation et voient les rendez-vous qui les concernent ; les administrateurs disposent d'une vue d'ensemble.",
  },
  {
    q: "Puis-je déléguer un rendez-vous à un collègue ?",
    a: "Oui. Un rendez-vous en attente ou confirmé peut être transmis à un collègue, qui le confirme, le refuse ou le délègue à son tour. S'il le refuse, le rendez-vous revient automatiquement à la personne qui le lui avait transmis, et chaque étape reste tracée.",
  },
  {
    q: "Mes données sont-elles isolées des autres organisations ?",
    a: "Oui. Chaque organisation dispose de son propre espace : ses utilisateurs, appels, dossiers et rendez-vous ne sont jamais visibles depuis une autre organisation.",
  },
];

function CallInProgressCard() {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-medium text-ink-muted">
          <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden />
          Appel en cours
        </p>
        <p className="font-mono text-xs text-ink">02:14</p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-600 text-white dark:text-cream">
          <Phone aria-hidden strokeWidth={1.5} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">Camille Rochat</p>
          <p className="font-mono text-xs text-ink-muted">+41 79 482 15 36</p>
        </div>
      </div>
      {/* Onde sonore : barres animées (landing-wave, globals.css), figées si mouvement réduit. */}
      <div className="mt-3 flex h-6 items-center gap-[3px]" aria-hidden>
        {WAVE.map((h, i) => (
          <span
            key={i}
            className="landing-wave w-[3px] flex-1 rounded-full bg-forest-600"
            style={{ height: `${h * 100}%`, animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function QueueCard() {
  return (
    <div className={`${CARD} overflow-hidden lg:pb-16`}>
      {/* Libellés à gauche : le coin droit de l'en-tête est recouvert par « Appel en cours » sur desktop. */}
      <div className="flex items-baseline gap-2 border-b border-border px-5 py-3.5">
        <p className="font-display text-lg italic text-ink">File d&apos;attente</p>
        <p className="font-mono text-xs text-ink-muted">· 42 prospects</p>
      </div>
      <ul className="divide-y divide-border">
        {PREVIEW_CALLS.map((c, i) => (
          <li key={c.phone} className={`items-center gap-3 px-5 py-2.5 text-sm ${i >= 5 ? "hidden sm:flex" : "flex"} ${i === 0 ? "bg-forest-50" : ""}`}>
            <WaveBadge waveNumber={c.wave} />
            <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
            <span className="hidden font-mono text-xs text-forest-600 sm:inline">{c.phone}</span>
            <StatusBadge label={c.status} color={c.color} className="w-28 shrink-0 text-xs" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayCard() {
  return (
    <div className={`${CARD} p-4`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarDays aria-hidden strokeWidth={1.5} className="h-4 w-4 text-forest-600" />
        Aujourd&apos;hui
      </p>
      <ul className="mt-3 space-y-2.5">
        {TODAY.map((e) => (
          <li key={e.time} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3">
            <span className="font-mono text-xs text-ink-muted">{e.time}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink">{e.who}</span>
              <StatusBadge label={TYPE_LABEL[e.type]} color={TYPE_COLOR[e.type]} className="text-xs text-ink-muted" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pièce centrale du héros, en couches sur desktop (appel en cours en haut à droite, file
 * d'attente au centre, agenda du jour en bas à droite, décalés et superposés) ; pile simple
 * sur mobile. Non interactive (inert), données fictives, décrite par la légende.
 */
function HeroComposition() {
  return (
    <figure aria-labelledby="preview-caption">
      {/* Décalages calibrés sur les hauteurs réelles des cartes (mesurées en navigateur) : « Appel en
          cours » ne chevauche que l'en-tête de la file (pt-24), « Aujourd'hui » que sa marge basse
          vide (pb-44 ≈ hauteur de la carte − 42px, dans les 64px de lg:pb-16 de la file) — aucune
          ligne d'appel n'est jamais masquée. */}
      <div inert className="relative flex flex-col gap-4 lg:block lg:pb-44 lg:pt-24">
        <div className="landing-rise [--delay:340ms] lg:absolute lg:right-0 lg:top-0 lg:z-10 lg:w-60">
          <CallInProgressCard />
        </div>
        <div className="landing-rise [--delay:200ms] lg:mr-10">
          <QueueCard />
        </div>
        <div className="landing-rise [--delay:480ms] lg:absolute lg:bottom-0 lg:right-0 lg:z-10 lg:w-64">
          <TodayCard />
        </div>
      </div>
      <figcaption id="preview-caption" className="mt-5 text-right font-display text-sm italic text-ink-muted">
        Aperçu de la file d&apos;appels — données fictives.
      </figcaption>
    </figure>
  );
}

export function LandingPage() {
  return (
    // data-landing : active le défilement doux des ancres internes (globals.css), sur cette page seulement.
    <div data-landing className="flex min-h-screen flex-col bg-cream">
      <LandingHeader />
      <main className="flex-1">
        {/* grid-cols-1 (et non la colonne implicite) + min-w-0 : sinon un contenu à largeur
            minimale élargit la piste et le héros déborde de l'écran sur mobile. */}
        <section
          id="prospection"
          className={`${CONTAINER} grid scroll-mt-16 grid-cols-1 items-center gap-x-16 gap-y-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:pb-28 lg:pt-20 [&>*]:min-w-0`}
        >
          <div>
            <p className={`landing-rise ${KICKER}`}>Prospection téléphonique</p>
            <h1 className="landing-rise mt-6 font-display text-[clamp(2.5rem,5.4vw,4.375rem)] font-bold leading-[1.04] tracking-[-0.015em] text-ink [--delay:80ms] [text-wrap:balance]">
              {/* {" "} explicites entre les lignes : sans eux, le nom accessible colle les mots. */}
              <span className="block">De l&apos;appel</span>{" "}
              <span className="block">au rendez-vous,</span>{" "}
              <span className="block font-semibold italic text-forest-600">sans changer d&apos;outil.</span>
            </h1>
            <p className="landing-rise mt-7 max-w-[34rem] text-base leading-relaxed text-ink-muted [--delay:160ms] [text-wrap:pretty] sm:text-lg">
              CLIENTIA réunit la prospection téléphonique, la prise de rendez-vous et un calendrier partagé par toute
              l&apos;équipe. Chaque appel qualifié devient un dossier client, chaque rendez-vous a son agent — et rien
              ne se perd entre les deux.
            </p>
            <div className="landing-rise mt-9 [--delay:240ms]">
              <Link href="/login" className={`${BUTTON_PRIMARY} group`}>
                Se connecter
                <ArrowRight aria-hidden strokeWidth={1.5} className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
              <p className="mt-4 text-sm text-ink-muted">Accès sur invitation de l&apos;administrateur de votre organisation.</p>
            </div>
          </div>

          <HeroComposition />
        </section>

        <section aria-labelledby="benefits-title" className={SECTION}>
          <div className={`${CONTAINER} py-20 lg:py-28`}>
            <p className={KICKER}>Comment ça marche</p>
            <h2 id="benefits-title" className={`${H2} mt-4 max-w-xl`}>
              Tout le parcours, dans un seul outil
            </h2>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((b, i) => {
                const Icon = b.icon;
                return (
                  // target: : la carte visée par une ancre de l'en-tête est soulignée (les 4 cartes partagent une ligne sur desktop).
                  <li
                    key={b.title}
                    id={b.id}
                    className="flex scroll-mt-24 flex-col rounded-lg border border-border bg-surface p-6 transition-colors duration-150 target:border-forest-600 target:ring-1 target:ring-forest-600"
                  >
                    <div className="flex items-start justify-between">
                      <span aria-hidden className="font-display text-5xl font-semibold leading-none text-terracotta-500">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-forest-50 text-forest-600">
                        <Icon aria-hidden strokeWidth={1.5} className="h-[18px] w-[18px]" />
                      </span>
                    </div>
                    <h3 className="mt-8 text-base font-semibold text-ink">{b.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="pricing-title" className="pb-20 lg:pb-28">
          <div className={CONTAINER}>
            <div className="grid grid-cols-1 divide-y divide-forest-600/20 rounded-lg bg-forest-50 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <h2 id="pricing-title" className={`${H2} p-8 sm:p-12`}>
                Une tarification sur devis,{" "}
                <em className="font-semibold text-forest-600">adaptée à la taille et aux besoins de votre organisation.</em>
              </h2>
              <div className="flex flex-col items-start justify-center gap-6 p-8 sm:p-12">
                <p className="max-w-md text-base leading-relaxed text-ink-muted [text-wrap:pretty]">
                  Nombre d&apos;utilisateurs, volume d&apos;appels, façon de travailler : parlons-en, et nous vous
                  proposons un devis.
                </p>
                <a href="#contact" className={BUTTON_PRIMARY}>
                  Demander un devis
                </a>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="team-title" className={SECTION}>
          <div className={`${CONTAINER} py-20 lg:py-28`}>
            <h2 id="team-title" className={H2}>
              Ce qu&apos;en dit l&apos;équipe
            </h2>
            <p className="mt-4 max-w-2xl text-base text-ink-muted">
              Pourquoi CLIENTIA est construit ainsi, raconté par celles et ceux qui le conçoivent.
            </p>
            <ul className="mt-12 grid gap-5 md:grid-cols-3">
              {TEAM_QUOTES.map((t) => (
                <li key={t.quote}>
                  <figure className="flex h-full flex-col rounded-lg border border-border bg-surface p-7">
                    <span aria-hidden className="font-display text-6xl leading-[0.6] text-terracotta-500">
                      “
                    </span>
                    <blockquote className="mt-5 flex-1 text-base leading-relaxed text-ink [text-wrap:pretty]">
                      {t.quote}
                    </blockquote>
                    <figcaption className="mt-7 flex items-center gap-3 border-t border-border pt-5">
                      <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-50 font-mono text-xs font-semibold text-forest-600">
                        {t.initials}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">L&apos;équipe CLIENTIA</span>
                        <span className="block font-mono text-[11px] uppercase tracking-wider text-ink-muted">{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq-title" className={SECTION}>
          <div className={`${CONTAINER} grid grid-cols-1 gap-x-16 gap-y-10 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:py-28`}>
            <h2 id="faq-title" className={H2}>
              Questions <em className="font-semibold text-forest-600">fréquentes</em>
            </h2>
            {/* Accordéon natif <details>/<summary> : clavier et lecteurs d'écran gérés par le navigateur, sans JS. */}
            <div className="border-t border-border">
              {FAQ.map((item) => (
                <details key={item.q} className="group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Plus
                      aria-hidden
                      strokeWidth={1.5}
                      className="h-5 w-5 shrink-0 text-forest-600 transition-transform duration-150 group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-2xl pb-6 pr-10 text-sm leading-relaxed text-ink-muted [text-wrap:pretty]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Vert forêt FIXE (#1F6F54, accent clair du brief §3.1) dans les deux thèmes : bloc sombre,
            texte clair. Le token forest-600 passe à #3FA383 en sombre, trop clair pour du texte blanc. */}
        <section id="contact" aria-labelledby="contact-title" className="scroll-mt-16 bg-[#1f6f54]">
          <div className={`${CONTAINER} grid grid-cols-1 items-center gap-8 py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-24`}>
            <div>
              <h2 id="contact-title" className="font-display text-3xl font-semibold leading-tight text-white [text-wrap:balance] sm:text-4xl">
                Parlons de votre organisation.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-white">Une question, un devis, une démonstration ? Écrivez-nous.</p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={`${BUTTON_BASE} bg-[#f6f4ef] text-[#14171c] hover:bg-white focus-visible:ring-white focus-visible:ring-offset-[#1f6f54]`}
              >
                Nous écrire
              </a>
              <p className="flex items-center gap-2 font-mono text-sm text-white">
                <Mail aria-hidden strokeWidth={1.5} className="h-4 w-4" />
                {CONTACT_EMAIL}
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="px-4 py-6 text-center font-mono text-xs text-ink-muted">© {new Date().getFullYear()} CLIENTIA</footer>
    </div>
  );
}
