"use client";

import {
  AlarmClock,
  ArrowRightLeft,
  BadgeCheck,
  BookOpen,
  CalendarPlus,
  Check,
  FileSpreadsheet,
  FolderPlus,
  Mail,
  PhoneOutgoing,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { stagger, useInView } from "./motion";

/* ------------------------------------------------------------------ */
/* Scène 1 — Import                                                    */
/* ------------------------------------------------------------------ */

const IMPORTED = [
  { name: "Thomas Girard", phone: "+33 7 81 34 56 20" },
  { name: "Sophie Aubert", phone: "+33 6 77 20 14 63" },
  { name: "Marc Zbinden", phone: "+41 79 310 44 87" },
  { name: "Inès Carpentier", phone: "+33 6 58 02 39 71" },
];

function ImportScene() {
  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="rounded-md border border-dashed border-border bg-surface-subtle p-5">
        <div className="lp-drop inline-flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5 shadow-raised">
          <FileSpreadsheet aria-hidden strokeWidth={1.5} className="h-6 w-6 text-forest-600" />
          <div>
            <p className="text-sm font-medium text-ink">prospects-novembre.xlsx</p>
            <p className="font-mono text-xs text-ink-muted">42 lignes</p>
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="lp-bar h-full origin-left rounded-full bg-forest-600" />
        </div>
      </div>

      <ul className="lp-stagger mt-5 border-t border-border">
        {IMPORTED.map((row, i) => (
          <li key={row.phone} style={stagger(15 + i)} className="flex h-11 items-center gap-3 border-b border-border text-sm">
            <WaveBadge waveNumber={4} />
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name}</span>
            <span className="hidden font-mono text-xs text-ink-muted sm:inline">{row.phone}</span>
            <StatusBadge label="À contacter" color="#6B7280" className="w-28 shrink-0 text-xs" />
          </li>
        ))}
      </ul>

      <div className="lp-stagger mt-auto pt-5">
        <p style={stagger(20)} className="flex items-center gap-2 text-sm text-ink">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-forest-600 text-white dark:text-cream">
            <Check aria-hidden strokeWidth={2} className="h-3 w-3" />
          </span>
          <span>
            <strong className="font-semibold">42 prospects importés</strong>
            <span className="text-ink-muted"> · aucun ignoré · vague V-4</span>
          </span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scène 2 — Qualifier (interactive)                                   */
/* ------------------------------------------------------------------ */

type Effect = "default" | "recall" | "dossier" | "closed" | "none";

/** Les 11 statuts d'appel par défaut et leur comportement (backend organizations/defaultData.ts). */
const STATUSES: { label: string; color: string; effect: Effect }[] = [
  { label: "À contacter", color: "#6B7280", effect: "default" },
  { label: "Ne répond pas", color: "#D97706", effect: "recall" },
  { label: "Occupé", color: "#D97706", effect: "recall" },
  { label: "Répondeur", color: "#D97706", effect: "recall" },
  { label: "À rappeler", color: "#D97706", effect: "recall" },
  { label: "Pas intéressé", color: "#DC2626", effect: "closed" },
  { label: "Numéro invalide", color: "#DC2626", effect: "closed" },
  { label: "Déjà client", color: "#DC2626", effect: "closed" },
  { label: "Ne pas rappeler", color: "#DC2626", effect: "closed" },
  { label: "RDV pris", color: "#16A34A", effect: "dossier" },
  { label: "Autre", color: "#6B7280", effect: "none" },
];

const EFFECTS: Record<Effect, { icon: LucideIcon; title: string; text: string }> = {
  default: { icon: PhoneOutgoing, title: "Statut d'arrivée", text: "C'est le statut donné à l'import : le prospect attend son premier appel." },
  recall: { icon: AlarmClock, title: "Date de rappel obligatoire", text: "Le rappel est programmé au moment de la qualification. Rien ne repose sur la mémoire de l'agent." },
  dossier: { icon: FolderPlus, title: "Le dossier client est créé", text: "L'appel ouvre le dossier client, qui est confié à un agent RDV." },
  closed: { icon: BookOpen, title: "Aucune suite à planifier", text: "L'appel est clos et reste consultable dans le journal." },
  none: { icon: BookOpen, title: "Qualifié, sans règle particulière", text: "L'appel reste consultable dans le journal." },
};

function QualifyScene() {
  const [selected, setSelected] = useState(4);
  const status = STATUSES[selected];
  const effect = EFFECTS[status.effect];
  const Icon = effect.icon;

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">Thomas Girard</p>
          <p className="font-mono text-xs text-ink-muted">+33 7 81 34 56 20</p>
        </div>
        <StatusBadge key={status.label} label={status.label} color={status.color} variant="outline" className="lp-swap shrink-0" />
      </div>

      <p className="mt-4 text-xs font-medium text-ink-muted">Choisissez un statut</p>
      <div className="lp-stagger mb-5 mt-2.5 flex flex-wrap gap-1.5">
        {STATUSES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            style={stagger(i * 0.45)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              i === selected ? "border-forest-600 bg-forest-50" : "border-border hover:border-ink-faint hover:bg-surface-subtle",
            )}
          >
            <StatusBadge label={s.label} color={s.color} className="text-xs" />
          </button>
        ))}
      </div>

      <div key={status.effect} aria-live="polite" className="lp-swap mt-auto flex gap-3 rounded-md bg-surface-subtle p-4 max-lg:mt-5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-600 text-white dark:text-cream">
          <Icon aria-hidden strokeWidth={1.5} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{effect.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{effect.text}</p>
          {status.effect === "recall" && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-ink">
              <AlarmClock aria-hidden strokeWidth={1.5} className="h-3.5 w-3.5 text-forest-600" />
              Rappel · demain · 10:00
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scène 3 — Dossier client                                            */
/* ------------------------------------------------------------------ */

const FIELDS = [
  { label: "Civilité", value: "Madame" },
  { label: "Pays", value: "Suisse" },
  { label: "Type de rendez-vous", value: "RDV visio" },
  { label: "Créé depuis", value: "Appel du jour" },
];

function DossierScene() {
  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="lp-stagger flex items-start justify-between gap-4 border-b border-border pb-4">
        <div style={stagger(0)} className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">Dossier client</p>
          <p className="mt-1 truncate font-display text-2xl font-semibold text-ink">Camille Rochat</p>
          <p className="font-mono text-xs text-ink-muted">+41 79 482 15 36</p>
        </div>
        <StatusBadge label="Nouveau" color="#6B7280" variant="outline" className="shrink-0" />
      </div>

      <dl className="lp-stagger mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
        {FIELDS.map((f, i) => (
          <div key={f.label} style={stagger(2 + i)}>
            <dt className="text-xs text-ink-muted">{f.label}</dt>
            <dd className="mt-1 border-b border-border pb-2 text-sm font-medium text-ink">{f.value}</dd>
          </div>
        ))}
        <div style={stagger(6)} className="col-span-2">
          <dt className="flex items-center gap-2 text-xs text-ink-muted">
            Canal d&apos;origine
            <span className="rounded-sm bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">champ personnalisé</span>
          </dt>
          <dd className="mt-1 border-b border-border pb-2 text-sm font-medium text-ink">Recommandation</dd>
        </div>
      </dl>

      <div className="lp-stagger mt-auto pt-5">
        <div style={stagger(8)} className="flex items-center gap-3 rounded-md bg-forest-50 p-3.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-600 font-mono text-xs font-semibold text-white dark:text-cream">
            EF
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Élodie Favre</p>
            <p className="text-xs text-ink-muted">Agent RDV assigné au dossier</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scène 4 — Rendez-vous                                               */
/* ------------------------------------------------------------------ */

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const HOURS = ["09:00", "10:00", "11:00", "12:00"];

const TRACE: { icon: LucideIcon; text: string }[] = [
  { icon: CalendarPlus, text: "Rendez-vous créé, en attente de confirmation" },
  { icon: ArrowRightLeft, text: "Délégué à Marc Dubuis par l'administrateur" },
  { icon: Check, text: "Confirmé par Marc Dubuis" },
  { icon: Mail, text: "E-mail de confirmation envoyé au client" },
  { icon: BadgeCheck, text: "Marqué honoré" },
];

function AppointmentScene() {
  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Semaine miniature : l'événement se déroule dans la colonne du jeudi. */}
      <div aria-hidden className="grid grid-cols-[2.75rem_repeat(5,minmax(0,1fr))] text-center">
        <span />
        {DAYS.map((d) => (
          <span key={d} className={cn("pb-2 text-xs font-medium", d === "Jeu" ? "text-forest-600" : "text-ink-muted")}>
            {d}
          </span>
        ))}
        {HOURS.map((h, row) => (
          <div key={h} className="col-span-6 grid h-9 grid-cols-subgrid border-t border-border">
            <span className="pr-2 pt-0.5 text-right font-mono text-[10px] text-ink-muted">{h}</span>
            {DAYS.map((d) => (
              <span key={d} className="relative border-l border-border">
                {d === "Jeu" && row === 1 && (
                  <span className="lp-event absolute inset-x-0.5 top-[18px] z-10 flex h-9 flex-col justify-center rounded-sm border border-forest-600 bg-forest-50 px-1.5 text-left">
                    <span className="truncate text-[10px] font-semibold leading-tight text-ink">C. Rochat</span>
                    <span className="truncate font-mono text-[9px] leading-tight text-ink-muted">10:30 · visio</span>
                  </span>
                )}
                {d === "Mar" && row === 0 && <span className="absolute inset-x-0.5 top-0.5 h-8 rounded-sm bg-surface-subtle" />}
                {d === "Ven" && row === 2 && <span className="absolute inset-x-0.5 top-0.5 h-[52px] rounded-sm bg-surface-subtle" />}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Trace du rendez-vous : chaque étape reste enregistrée. */}
      <ol className="lp-stagger mt-auto border-t border-border pt-4 max-lg:mt-6">
        {TRACE.map((t, i) => {
          const Icon = t.icon;
          const last = i === TRACE.length - 1;
          return (
            <li key={t.text} style={stagger(6 + i * 2.2)} className="relative flex items-center gap-3 pb-2.5 last:pb-0">
              {!last && <span aria-hidden className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px bg-border" />}
              <span
                className={cn(
                  "inline-flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border",
                  last ? "border-terracotta-500 bg-terracotta-500 text-white" : "border-forest-600 text-forest-600",
                )}
              >
                <Icon aria-hidden strokeWidth={1.75} className="h-3 w-3" />
              </span>
              <span className={cn("text-[13px]", last ? "font-semibold text-ink" : "text-ink")}>{t.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parcours                                                            */
/* ------------------------------------------------------------------ */

const STEPS: { rail: string; title: string; text: string; Scene: ComponentType }[] = [
  {
    rail: "Import",
    title: "Vos listes deviennent une file d'appels.",
    text: "Déposez un fichier Excel ou CSV : chaque prospect entre dans la file, prêt à être appelé. Chaque import reçoit un numéro de vague, pour comparer vos lots dans le temps.",
    Scene: ImportScene,
  },
  {
    rail: "Appel",
    title: "Un statut par appel, en un clic.",
    text: "Essayez dans l'aperçu : certains statuts exigent une date de rappel, un autre ouvre le dossier client. Ces règles sont celles de votre organisation, pas les nôtres.",
    Scene: QualifyScene,
  },
  {
    rail: "Dossier",
    title: "L'appel abouti devient un dossier.",
    text: "Qualifié « RDV pris », l'appel crée le dossier client, déjà rattaché au prospect et confié à un agent RDV. Rien à ressaisir, rien à transmettre de vive voix.",
    Scene: DossierScene,
  },
  {
    rail: "Rendez-vous",
    title: "Le rendez-vous a son agent, et sa trace.",
    text: "Confirmé, délégué, honoré ou manqué : chaque étape est enregistrée, et le client reçoit ses e-mails de confirmation et de rappel.",
    Scene: AppointmentScene,
  },
];

const N = STEPS.length;
const CARD = "rounded-lg border border-border bg-surface shadow-raised";

/** Sous lg : la scène est posée sous son texte et s'anime à son entrée à l'écran. */
function InlineScene({ Scene }: { Scene: ComponentType }) {
  const [ref, inView] = useInView<HTMLDivElement>({ once: true, margin: "0px 0px -15% 0px" });
  return (
    <div ref={ref} data-active={inView} className={cn(CARD, "mt-8 flex min-h-[25rem] flex-col p-5 lg:hidden")}>
      <Scene />
    </div>
  );
}

/**
 * Le parcours en quatre étapes. Sur grand écran, l'aperçu reste épinglé pendant que le texte
 * défile : l'étape active change la scène, et le rail (la chaîne du logo, trois maillons verts
 * puis un terracotta) se remplit avec le défilement. Sur petit écran, chaque étape porte sa scène.
 */
export function Journey() {
  const stepsRef = useRef<HTMLOListElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const steps = stepsRef.current;
    if (!steps) return;
    let frame = 0;
    const update = () => {
      const rect = steps.getBoundingClientRect();
      const p = Math.min(0.999, Math.max(0, (window.innerHeight * 0.5 - rect.top) / rect.height));
      setActive(Math.floor(p * N));
      const fill = Math.min(1, Math.max(0, (p * N - 0.5) / (N - 1)));
      railRef.current?.style.setProperty("--fill", fill.toFixed(4));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="mt-14 grid grid-cols-1 gap-x-20 lg:mt-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] [&>*]:min-w-0">
      {/* Aperçu épinglé (grand écran) */}
      <div className="hidden self-start lg:sticky lg:top-24 lg:block lg:py-10">
        <div ref={railRef} aria-hidden className="relative mb-9">
          <div className="absolute left-[12.5%] right-[12.5%] top-[11px] h-[5px] bg-border">
            <div className="lp-rail-fill h-full" />
          </div>
          <ol className="relative grid grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.rail} className="flex flex-col items-center gap-3">
                <span
                  className={cn(
                    "h-7 w-7 rounded-full border-[5px] bg-cream transition-colors duration-300",
                    i > active ? "border-border" : i === N - 1 ? "border-terracotta-500" : "border-forest-600",
                  )}
                />
                <span className={cn("text-sm transition-colors duration-300", i === active ? "font-semibold text-ink" : "text-ink-muted")}>
                  {s.rail}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className={cn(CARD, "relative h-[29rem]")}>
          {STEPS.map(({ rail, Scene }, i) => (
            <div key={rail} data-active={i === active} inert={i !== active} className="lp-scene absolute inset-0 p-7">
              <Scene />
            </div>
          ))}
        </div>
      </div>

      {/* Étapes */}
      <ol ref={stepsRef} className="space-y-20 lg:space-y-0">
        {STEPS.map((s, i) => (
          <li key={s.rail} className="flex flex-col justify-center lg:min-h-[76vh]">
            <p className="flex items-center gap-3 text-sm font-medium text-ink-muted">
              <span
                aria-hidden
                className={cn(
                  "h-4 w-4 rounded-full border-[3px] transition-colors duration-300",
                  i === N - 1 ? "border-terracotta-500" : "border-forest-600",
                  i !== active && "lg:border-border",
                )}
              />
              Étape {i + 1} sur {N} · {s.rail}
            </p>
            <h3
              className={cn(
                "mt-5 font-display text-2xl leading-[1.15] transition-colors duration-500 [text-wrap:balance] sm:text-[2.1rem]",
                i === active ? "text-ink" : "text-ink lg:text-ink-muted",
              )}
            >
              {s.title}
            </h3>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted [text-wrap:pretty]">{s.text}</p>
            <InlineScene Scene={s.Scene} />
          </li>
        ))}
      </ol>
    </div>
  );
}
