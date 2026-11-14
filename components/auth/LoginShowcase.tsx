"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { usePrefersReducedMotion } from "@/components/landing/motion";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";

/** Les quatre maillons du parcours (la chaîne du logo : trois verts, un terracotta). Données fictives. */
const STEPS: { name: string; text: string; sample: ReactNode }[] = [
  {
    name: "Import",
    text: "Vos listes Excel ou CSV deviennent une file d'appels.",
    sample: (
      <>
        <WaveBadge waveNumber={4} />
        <span className="text-sm text-ink">42 prospects ajoutés à la file</span>
      </>
    ),
  },
  {
    name: "Appel",
    text: "Chaque appel est qualifié en un clic.",
    sample: (
      <>
        <span className="text-sm font-medium text-ink">Julien Moreau</span>
        <StatusBadge label="À rappeler" color="#D97706" variant="outline" />
      </>
    ),
  },
  {
    name: "Dossier",
    text: "L'appel abouti ouvre le dossier client.",
    sample: (
      <>
        <span className="text-sm font-medium text-ink">Camille Rochat</span>
        <span className="text-sm text-ink-muted">confié à Élodie Favre</span>
      </>
    ),
  },
  {
    name: "Rendez-vous",
    text: "Confirmé, délégué, suivi jusqu'au bout.",
    sample: (
      <>
        <CalendarDays aria-hidden strokeWidth={1.5} className="h-4 w-4 text-forest-600" />
        <span className="text-sm font-medium text-ink">Jeudi · 10:30</span>
        <StatusBadge label="Confirmé" color="#16A34A" className="text-sm" />
      </>
    ),
  },
];

const STEP_MS = 3400;

/**
 * Panneau de marque de la page de connexion (grand écran) : le parcours en quatre étapes, qui
 * défile seul. Un clic ou le focus sur une étape la sélectionne et arrête le défilement ;
 * le survol le met en pause. Mouvement réduit : pas de défilement automatique.
 */
export function LoginShowcase() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const running = auto && !paused && !reduced;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [running]);

  function select(i: number) {
    setActive(i);
    setAuto(false);
  }

  return (
    <aside
      aria-label="Le parcours CLIENTIA"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="relative hidden flex-col justify-center bg-forest-50 px-12 py-16 lg:flex xl:px-20"
    >
      <p className="landing-rise max-w-md font-display text-3xl leading-[1.12] text-ink [text-wrap:balance] xl:text-4xl">
        De l&apos;appel au <span className="whitespace-nowrap">rendez-vous,</span> <span className="text-forest-600">sans changer d&apos;outil.</span>
      </p>

      <ol className="mt-14 max-w-md">
        {STEPS.map((step, i) => {
          const on = i === active;
          const last = i === STEPS.length - 1;
          return (
            <li key={step.name} className="landing-rise relative pb-2 pl-12" style={{ "--delay": `${120 + i * 90}ms` } as React.CSSProperties}>
              {/* Maillon : anneau du logo, relié au suivant. */}
              {!last && <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-[5px] bg-forest-600/25" />}
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1 h-7 w-7 rounded-full border-[5px] transition-colors duration-300",
                  last ? "border-terracotta-500" : "border-forest-600",
                  on ? (last ? "bg-terracotta-500" : "bg-forest-600") : "bg-forest-50",
                )}
              />
              <button
                type="button"
                aria-expanded={on}
                onClick={() => select(i)}
                onFocus={() => select(i)}
                className="block w-full rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-4 focus-visible:ring-offset-forest-50"
              >
                <span className={cn("font-display text-lg transition-colors duration-300", on ? "text-ink" : "text-ink-muted hover:text-ink")}>
                  {step.name}
                </span>
              </button>
              {/* Détail : hauteur animée par la grille (0fr → 1fr), sans mesurer le contenu. */}
              <div className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-out", on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden" inert={!on}>
                  <p className="pt-1 text-base leading-relaxed text-ink-muted">{step.text}</p>
                  <div className="mb-5 mt-4 flex h-12 items-center gap-3 rounded-md border border-border bg-surface px-4 shadow-flat">{step.sample}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="absolute bottom-8 left-12 text-xs text-ink-muted xl:left-20">Aperçu illustratif, données fictives.</p>
    </aside>
  );
}
