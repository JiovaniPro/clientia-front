"use client";

import {
  AlarmClock,
  CalendarDays,
  Check,
  History,
  LineChart,
  Mail,
  MousePointer2,
  Phone,
  Search,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { useInView, usePrefersReducedMotion } from "./motion";

/** Statuts et couleurs = valeurs par défaut d'une organisation (backend organizations/defaultData.ts). */
const ROWS = [
  { name: "Camille Rochat", phone: "+41 79 482 15 36", status: "À contacter", color: "#6B7280", wave: 3 },
  { name: "Julien Moreau", phone: "+33 6 12 48 93 07", status: "À rappeler", color: "#D97706", wave: 3 },
  { name: "Nadia Keller", phone: "+41 78 603 22 91", status: "Ne répond pas", color: "#D97706", wave: 2 },
  { name: "Thomas Girard", phone: "+33 7 81 34 56 20", status: "À contacter", color: "#6B7280", wave: 4 },
  { name: "Léa Bonvin", phone: "+41 76 215 88 40", status: "Répondeur", color: "#D97706", wave: 2 },
  { name: "Antoine Lefèvre", phone: "+33 6 45 09 71 18", status: "Pas intéressé", color: "#DC2626", wave: 1 },
  { name: "Sophie Aubert", phone: "+33 6 77 20 14 63", status: "À contacter", color: "#6B7280", wave: 4 },
];

const MENU = [
  { label: "À rappeler", color: "#D97706" },
  { label: "Ne répond pas", color: "#D97706" },
  { label: "Pas intéressé", color: "#DC2626" },
  { label: "RDV pris", color: "#16A34A" },
];

const RAIL = [LineChart, Phone, History, Users, CalendarDays, AlarmClock];

/**
 * Scénario en boucle. Chaque phase dure DURATIONS[phase] ms :
 * 0 repos · 1 le curseur va au statut · 2 menu ouvert · 3 curseur sur « RDV pris » · 4 statut choisi
 * · 5 dossier client · 6 rendez-vous en attente · 7 confirmé + e-mail.
 */
const DURATIONS = [1500, 950, 650, 850, 1000, 1700, 1500, 3400];
const LAST = DURATIONS.length - 1;

/** Position d'un élément par rapport à un ancêtre, sans getBoundingClientRect (insensible à l'inclinaison 3D). */
function offsetWithin(el: HTMLElement, root: HTMLElement) {
  let x = el.offsetWidth / 2;
  let y = el.offsetHeight / 2;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/**
 * Pièce centrale du héros : une fenêtre de l'application qui joue seule le parcours complet —
 * un appel qualifié « RDV pris » crée le dossier client, puis le rendez-vous est confirmé.
 * Non interactive (inert), données fictives, décrite par la légende. Mouvement réduit :
 * l'état final est affiché, sans boucle ni curseur.
 */
export function HeroDemo() {
  const reduced = usePrefersReducedMotion();
  const [figureRef, inView] = useInView<HTMLElement>();
  const [step, setStep] = useState(0);
  const phase = reduced ? LAST : step;

  const windowRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLSpanElement>(null);
  const optionRef = useRef<HTMLLIElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  // La boucle ne tourne que lorsque la fenêtre est à l'écran.
  useEffect(() => {
    if (reduced || !inView) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % DURATIONS.length), DURATIONS[step]);
    return () => clearTimeout(t);
  }, [step, reduced, inView]);

  // Le curseur suit le scénario : cellule de statut, option « RDV pris », puis retour au repos.
  useEffect(() => {
    const win = windowRef.current;
    const cursor = cursorRef.current;
    if (!win || !cursor) return;
    const target = phase === 1 || phase === 2 ? cellRef.current : phase === 3 || phase === 4 ? optionRef.current : null;
    const { x, y } = target ? offsetWithin(target, win) : { x: win.offsetWidth * 0.62, y: win.offsetHeight * 0.86 };
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }, [phase]);

  // Légère inclinaison 3D sous le pointeur (souris uniquement).
  useEffect(() => {
    const tilt = tiltRef.current;
    if (!tilt || reduced || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        tilt.style.setProperty("--ry", `${((e.clientX / window.innerWidth - 0.5) * 6).toFixed(2)}deg`);
        tilt.style.setProperty("--rx", `${(-(e.clientY / window.innerHeight - 0.5) * 4).toFixed(2)}deg`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduced]);

  const qualified = phase >= 4;
  const menuOpen = phase === 2 || phase === 3;
  const panelOpen = phase >= 5;
  const rdvShown = phase >= 6;
  const confirmed = phase >= 7;

  return (
    <figure ref={figureRef} aria-labelledby="hero-demo-caption" className="lp-window relative">
      <div ref={tiltRef} className="lp-tilt">
        <div
          ref={windowRef}
          inert
          className="relative overflow-hidden rounded-lg border border-border bg-surface text-ink shadow-[0_50px_90px_-45px_rgb(20_23_28/0.5)]"
        >
          {/* Barre de fenêtre */}
          <div className="flex h-9 items-center gap-3 border-b border-border bg-surface-subtle px-3.5">
            <span className="flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full bg-border" />
              ))}
            </span>
            <span className="font-mono text-[11px] text-ink-muted">CLIENTIA · Appels</span>
          </div>

          <div className="flex">
            {/* Rail latéral replié, comme dans l'application */}
            <div className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-3 sm:flex">
              <span className="mb-3 h-5 w-5 rounded-full border-[3px] border-terracotta-500" />
              {RAIL.map((Icon, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md",
                    i === 1 ? "bg-forest-50 text-forest-600" : "text-ink-muted",
                  )}
                >
                  <Icon strokeWidth={1.5} className="h-4 w-4" />
                </span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
                <div>
                  <p className="text-base font-semibold leading-tight">Appels</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-muted">42 prospects · vague V-3 en cours</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden h-8 w-36 items-center gap-2 rounded-md border border-border px-2.5 text-xs text-ink-faint lg:flex">
                    <Search strokeWidth={1.5} className="h-3.5 w-3.5" />
                    Rechercher
                  </span>
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-forest-600 px-3 text-xs font-medium text-white dark:text-cream">
                    <Upload strokeWidth={1.5} className="h-3.5 w-3.5" />
                    Importer
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_7.5rem] gap-x-3 border-y border-border bg-surface-subtle px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted sm:grid-cols-[3.25rem_minmax(0,1fr)_9.5rem_7.5rem]">
                <span>Vague</span>
                <span>Nom</span>
                <span className="hidden sm:block">Téléphone</span>
                <span>Statut</span>
              </div>

              <ul>
                {ROWS.map((row, i) => {
                  const first = i === 0;
                  const status = first && qualified ? MENU[3] : { label: row.status, color: row.color };
                  return (
                    <li
                      key={row.phone}
                      className={cn(
                        "grid h-10 grid-cols-[3.25rem_minmax(0,1fr)_7.5rem] items-center gap-x-3 border-b border-border px-4 text-[13px] sm:grid-cols-[3.25rem_minmax(0,1fr)_9.5rem_7.5rem]",
                        first && !qualified && phase >= 1 && "bg-forest-50",
                        first && phase === 4 && "lp-row-flash",
                        i > 4 && "hidden sm:grid",
                      )}
                    >
                      <span>
                        <WaveBadge waveNumber={row.wave} />
                      </span>
                      <span className="truncate font-medium">{row.name}</span>
                      <span className="hidden font-mono text-xs text-ink-muted sm:block">{row.phone}</span>
                      <span ref={first ? cellRef : undefined} className="relative">
                        <StatusBadge label={status.label} color={status.color} className="text-xs" />
                        {first && (
                          <ul
                            data-open={menuOpen}
                            className="lp-menu absolute right-0 top-full z-10 mt-2 w-40 rounded-md border border-border bg-surface p-1 shadow-raised"
                          >
                            {MENU.map((m, j) => (
                              <li
                                key={m.label}
                                ref={j === 3 ? optionRef : undefined}
                                className={cn("rounded-sm px-2 py-1.5", j === 3 && phase === 3 && "bg-forest-50")}
                              >
                                <StatusBadge label={m.label} color={m.color} className="text-xs" />
                              </li>
                            ))}
                          </ul>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="h-4" />
            </div>
          </div>

          {/* Dossier client : glisse depuis la droite quand l'appel est qualifié « RDV pris ». */}
          <div
            data-open={panelOpen}
            className="lp-panel absolute bottom-0 right-0 top-9 z-20 flex w-[78%] flex-col border-l border-border bg-surface p-4 shadow-raised sm:w-[52%] sm:p-5"
          >
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">Dossier client</p>
              <StatusBadge label="Nouveau" color="#6B7280" variant="outline" className="text-[10px]" />
            </div>
            <p className="mt-3 text-lg font-semibold leading-tight">Camille Rochat</p>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">+41 79 482 15 36</p>

            <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Type de rendez-vous</dt>
                <dd className="font-medium">RDV visio</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Agent RDV</dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-forest-50 font-mono text-[9px] font-semibold text-forest-600">
                    EF
                  </span>
                  Élodie Favre
                </dd>
              </div>
            </dl>

            <div data-open={rdvShown} className="lp-pop mt-4 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <CalendarDays strokeWidth={1.5} className="h-3.5 w-3.5 text-forest-600" />
                  Jeudi · 10:30
                </p>
                <StatusBadge
                  key={confirmed ? "ok" : "wait"}
                  label={confirmed ? "Confirmé" : "En attente"}
                  color={confirmed ? "#16A34A" : "#D97706"}
                  className="lp-swap text-xs"
                />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Video strokeWidth={1.5} className="h-3.5 w-3.5" />
                Lien Google Meet joint
              </p>
            </div>

            <div
              data-open={confirmed}
              className="lp-pop mt-auto flex items-center gap-2 rounded-md bg-forest-50 px-3 py-2 text-[11px] font-medium text-ink"
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-600 text-white dark:text-cream">
                <Check strokeWidth={2} className="h-3 w-3" />
              </span>
              <Mail strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0 text-forest-600" />
              E-mail de confirmation envoyé
            </div>
          </div>

          {/* Curseur de démonstration (position posée par l'effet ci-dessus). */}
          <span
            ref={cursorRef}
            data-press={phase === 2 || phase === 4}
            className={cn("lp-cursor pointer-events-none absolute left-0 top-0 z-30", (reduced || phase >= 6) && "opacity-0")}
          >
            <MousePointer2 strokeWidth={1.5} className="h-5 w-5 fill-ink text-surface" />
          </span>
        </div>
      </div>
      <figcaption id="hero-demo-caption" className="mt-4 text-right text-sm text-ink-muted">
        Démonstration automatique, données fictives.
      </figcaption>
    </figure>
  );
}
