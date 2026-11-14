"use client";

import { ArrowRight, CalendarDays, FileSpreadsheet, Mail, Phone, ShieldCheck, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "./motion";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
/** Décalage sous le pointeur (--mx/--my, de -1 à 1, posés sur le panneau) : plus `depth` est grand, plus l'élément bouge. */
const parallax = (depth: number, floatDelay = 0) =>
  ({ translate: `calc(var(--mx, 0) * ${depth}px) calc(var(--my, 0) * ${depth}px)`, animationDelay: `${floatDelay}s` }) as CSSProperties;

const CARD = "rounded-lg border border-border bg-surface shadow-raised";

/** La chaîne du logo, tracée maillon après maillon : trois verts, un terracotta. */
function LogoChain({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 152 32" className={className} fill="none" strokeWidth="5">
      {[0, 1, 2, 3].map((i) => (
        <g key={i} stroke={i === 3 ? "var(--color-terracotta-500)" : "var(--color-forest-600)"} style={delay(i * 170)}>
          {i > 0 && <path className="lp-draw" pathLength={1} d={`M${i * 40 - 13} 16h18`} />}
          <circle className="lp-draw" pathLength={1} cx={16 + i * 40} cy="16" r="11" />
        </g>
      ))}
    </svg>
  );
}

/** Étiquette de fonctionnalité reliée au logo par les pointillés (très grand écran). */
function FeatureChip({ icon: Icon, label, className, depth, floatDelay }: { icon: LucideIcon; label: string; className: string; depth: number; floatDelay: number }) {
  return (
    <div style={parallax(depth, floatDelay)} className={cn("lp-float absolute hidden items-start gap-2 transition-[translate] duration-500 ease-out xl:flex", className)}>
      <div className={cn(CARD, "w-32 px-3 py-2.5")}>
        <p className="text-[11px] font-semibold text-ink">{label}</p>
        <span className="mt-2 block h-1.5 w-full rounded-full bg-surface-subtle" />
        <span className="mt-1.5 block h-1.5 w-2/3 rounded-full bg-surface-subtle" />
      </div>
      <span className={cn(CARD, "mt-3 inline-flex h-11 w-11 shrink-0 items-center justify-center text-forest-600")}>
        <Icon strokeWidth={1.5} className="h-5 w-5" />
      </span>
    </div>
  );
}

/** Carte produit inclinée des angles bas (grand écran). */
function FlankCard({ className, depth, floatDelay, children }: { className: string; depth: number; floatDelay: number; children: ReactNode }) {
  return (
    <div style={parallax(depth, floatDelay)} className={cn(CARD, "lp-float absolute hidden p-4 transition-[translate] duration-500 ease-out xl:block", className)}>
      {children}
    </div>
  );
}

const QUEUE = [
  { name: "Camille Rochat", wave: 3, status: "RDV pris", color: "#16A34A" },
  { name: "Julien Moreau", wave: 3, status: "À rappeler", color: "#D97706" },
  { name: "Nadia Keller", wave: 2, status: "Ne répond pas", color: "#D97706" },
  { name: "Thomas Girard", wave: 4, status: "À contacter", color: "#6B7280" },
];

const CHOICES = [
  { label: "À rappeler", color: "#D97706" },
  { label: "Répondeur", color: "#D97706" },
  { label: "Pas intéressé", color: "#DC2626" },
  { label: "RDV pris", color: "#16A34A", on: true },
];

const AGENDA = [
  { time: "Jeu. 10:30", who: "Camille Rochat", status: "Confirmé", color: "#16A34A" },
  { time: "Jeu. 14:00", who: "Luca Bernasconi", status: "En attente", color: "#D97706" },
  { time: "Ven. 09:00", who: "Inès Carpentier", status: "Confirmé", color: "#16A34A" },
];

/** Ce avec quoi le produit s'articule, en tuiles (pas de logos de marque). */
const TILES: { icon: LucideIcon; label: string; rotate: string }[] = [
  { icon: FileSpreadsheet, label: "Import Excel et CSV", rotate: "-rotate-6" },
  { icon: Phone, label: "File d'appels", rotate: "rotate-3 translate-y-3" },
  { icon: CalendarDays, label: "Calendrier partagé", rotate: "-rotate-3 translate-y-5" },
  { icon: Video, label: "Lien Google Meet", rotate: "rotate-6 translate-y-2" },
  { icon: Mail, label: "E-mails au client", rotate: "-rotate-2" },
];

const ROLES: { icon: LucideIcon; tone: string }[] = [
  { icon: Phone, tone: "bg-forest-600 text-white dark:text-cream" },
  { icon: CalendarDays, tone: "bg-terracotta-500 text-white" },
  { icon: ShieldCheck, tone: "bg-ink text-cream" },
];

/**
 * Héros : pleine largeur, sans cadre, sur une trame de points qui se fond dans la page. Au centre, le logo relié par des pointillés
 * animés à quatre étiquettes de fonctionnalités, le titre sur deux lignes, l'appel à l'action ;
 * dans les angles bas, des cartes produit inclinées ; en bas, une rangée de tuiles. Les éléments
 * flottants suivent légèrement le pointeur et restent entiers (aucun n'est rogné). Sous xl, seuls le texte et les tuiles restent.
 * Tout le décor est aria-hidden : données fictives, purement illustratives.
 */
export function Hero() {
  const reduced = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || reduced || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty("--mx", (((e.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
        panel.style.setProperty("--my", (((e.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
      });
    };
    panel.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      panel.removeEventListener("pointermove", onMove);
    };
  }, [reduced]);

  return (
    <section className="relative pt-16">
      <div ref={panelRef} className="relative mx-auto max-w-[96rem]">
        <div aria-hidden className="lp-dots absolute inset-0" />

        {/* Pointillés qui partent du logo vers les étiquettes (très grand écran). */}
        <svg aria-hidden viewBox="0 0 1400 260" preserveAspectRatio="none" fill="none" className="absolute inset-x-0 top-6 hidden h-[260px] w-full text-forest-600 xl:block">
          {["M655 108H420L315 180H212", "M420 108L330 58H232", "M745 108H980L1085 180H1188", "M980 108L1070 58H1168"].map((d) => (
            <path key={d} d={d} className="lp-flow" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.1 9" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <div aria-hidden>
          <FeatureChip icon={FileSpreadsheet} label="Import de listes" className="left-[5%] top-[3.25rem]" depth={8} floatDelay={0} />
          <FeatureChip icon={Phone} label="Statuts d'appel" className="left-[3.2%] top-[176px]" depth={12} floatDelay={-2} />
          <FeatureChip icon={CalendarDays} label="Calendrier partagé" className="right-[5%] top-[3.25rem] flex-row-reverse" depth={8} floatDelay={-4} />
          <FeatureChip icon={Mail} label="E-mails au client" className="right-[3.2%] top-[176px] flex-row-reverse" depth={12} floatDelay={-1} />

          {/* Angle bas gauche : la file d'appels, et la qualification posée dessus. */}
          <FlankCard className="bottom-[13.5rem] left-10 w-[19rem] -rotate-3" depth={-10} floatDelay={-3}>
            <p className="flex items-baseline justify-between text-sm font-semibold text-ink">
              Appels <span className="font-mono text-[11px] font-normal text-ink-muted">42 prospects</span>
            </p>
            <ul className="mt-3 border-t border-border">
              {QUEUE.map((row) => (
                <li key={row.name} className="flex h-9 items-center gap-2.5 border-b border-border text-xs">
                  <WaveBadge waveNumber={row.wave} />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name}</span>
                  <StatusBadge label={row.status} color={row.color} className="shrink-0 text-xs" />
                </li>
              ))}
            </ul>
          </FlankCard>
          <FlankCard className="bottom-12 left-28 w-60 rotate-3" depth={-16} floatDelay={-5}>
            <p className="text-xs font-medium text-ink-muted">Qualifier l&apos;appel</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {CHOICES.map((c) => (
                <span key={c.label} className={cn("rounded-md border px-2 py-1", c.on ? "border-forest-600 bg-forest-50" : "border-border")}>
                  <StatusBadge label={c.label} color={c.color} className="text-xs" />
                </span>
              ))}
            </div>
          </FlankCard>

          {/* Angle bas droit : le dossier client, et l'agenda de l'agent RDV. */}
          <FlankCard className="bottom-[19rem] right-10 w-64 rotate-3" depth={-10} floatDelay={-1.5}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-muted">Dossier client</p>
              <StatusBadge label="Nouveau" color="#6B7280" variant="outline" className="text-[10px]" />
            </div>
            <p className="mt-2 text-base font-semibold text-ink">Camille Rochat</p>
            <dl className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Type de rendez-vous</dt>
                <dd className="font-medium text-ink">RDV visio</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Agent RDV</dt>
                <dd className="font-medium text-ink">Élodie Favre</dd>
              </div>
            </dl>
          </FlankCard>
          <FlankCard className="bottom-12 right-20 w-[20rem] -rotate-3" depth={-16} floatDelay={-4}>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays strokeWidth={1.5} className="h-4 w-4 text-forest-600" />
              Rendez-vous
            </p>
            <ul className="mt-3 space-y-2">
              {AGENDA.map((e) => (
                <li key={e.time} className="flex items-center gap-3 rounded-md bg-surface-subtle px-2.5 py-2 text-xs">
                  <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-ink-muted">{e.time}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{e.who}</span>
                  <StatusBadge label={e.status} color={e.color} className="shrink-0 text-xs" />
                </li>
              ))}
            </ul>
          </FlankCard>
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-12 text-center sm:px-8 sm:pt-24 xl:pb-24">
          <span className={cn(CARD, "lp-up inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center")}>
            <LogoChain className="h-4 w-auto" />
          </span>

          <h1 className="lp-h1 mt-12 font-display text-[clamp(1.7rem,7.4vw,2.6rem)] leading-[1.14] text-ink lg:text-[min(3.6vw,3.25rem)]">
            {/* {" "} explicite : sans lui, le nom accessible colle les mots des deux lignes. */}
            <span className="lp-line">
              <span className="lg:whitespace-nowrap">Transformez vos appels</span>
            </span>{" "}
            <span className="lp-line">
              <span style={delay(110)} className="text-forest-600">
                en rendez-vous.
              </span>
            </span>
          </h1>

          <p style={delay(380)} className="lp-up mt-7 max-w-xl text-lg leading-relaxed text-ink-muted [text-wrap:pretty]">
            La file d&apos;appels, le dossier client et le calendrier de l&apos;équipe dans un seul outil. Rien ne se perd en
            route.
          </p>

          <p style={delay(470)} className="lp-up mt-9 flex flex-col items-center gap-3 text-sm font-medium text-ink sm:flex-row">
            <span aria-hidden className="flex -space-x-2">
              {ROLES.map(({ icon: Icon, tone }, i) => (
                <span key={i} className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-surface", tone)}>
                  <Icon strokeWidth={1.75} className="h-3.5 w-3.5" />
                </span>
              ))}
            </span>
            Pour callistes, agents RDV et administrateurs
          </p>

          <div style={delay(560)} className="lp-up mt-8">
            <a
              href="#contact"
              className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-md bg-forest-600 px-9 text-base font-semibold text-white shadow-[0_16px_40px_-12px_rgb(31_111_84/0.65)] transition-[background-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:bg-forest-700 hover:shadow-[0_22px_48px_-12px_rgb(31_111_84/0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:text-cream"
            >
              Demander une démonstration
              <ArrowRight aria-hidden strokeWidth={1.75} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
          </div>

          <p style={delay(650)} className="lp-up mt-5 text-sm text-ink-muted">
            Tarification sur devis. Déjà utilisateur ?{" "}
            <Link
              href="/login"
              className="whitespace-nowrap rounded-sm font-semibold text-ink underline decoration-forest-600 decoration-2 underline-offset-4 transition-colors duration-150 hover:text-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            >
              Se connecter
            </Link>
          </p>

          {/* Tuiles : ce avec quoi le produit s'articule. */}
          <ul className="mt-16 flex items-start justify-center gap-3 pb-6 sm:gap-7 xl:mt-24">
            {TILES.map(({ icon: Icon, label, rotate }, i) => (
              <li key={label} className={rotate}>
                <span
                  title={label}
                  style={{ animationDelay: `${-i * 1.3}s` }}
                  className={cn(CARD, "lp-float inline-flex h-12 w-12 items-center justify-center text-forest-600 transition-[scale,color] duration-200 hover:scale-110 hover:text-terracotta-500 sm:h-16 sm:w-16")}
                >
                  <Icon aria-hidden strokeWidth={1.5} className="h-5 w-5 sm:h-7 sm:w-7" />
                  <span className="sr-only">{label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
