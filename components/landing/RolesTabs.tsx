"use client";

import {
  AlarmClock,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  History,
  KeyRound,
  LineChart,
  ListChecks,
  Mail,
  Phone,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Navigation réelle de chaque rôle par défaut (lib/nav/navItems.ts) ; `current` = écran de départ. */
const ROLES: {
  name: string;
  lead: string;
  nav: { icon: LucideIcon; label: string; current?: boolean }[];
  points: string[];
}[] = [
  {
    name: "Agent calliste",
    lead: "Il appelle, il qualifie, il passe au suivant.",
    nav: [
      { icon: LineChart, label: "Mes statistiques" },
      { icon: Phone, label: "Appels", current: true },
      { icon: History, label: "Journal" },
      { icon: Users, label: "Dossiers" },
      { icon: AlarmClock, label: "Rappels" },
      { icon: Bell, label: "Notifications" },
    ],
    points: [
      "Une file d'appels alimentée par les imports",
      "La qualification en un clic, le rappel programmé dans la foulée",
      "Le dossier client ouvert depuis l'appel abouti",
    ],
  },
  {
    name: "Agent RDV",
    lead: "Il reçoit les dossiers et tient les rendez-vous.",
    nav: [
      { icon: BarChart3, label: "Tableau de bord", current: true },
      { icon: Users, label: "Mes clients" },
      { icon: CalendarDays, label: "Mon calendrier" },
      { icon: Mail, label: "E-mails" },
      { icon: Bell, label: "Notifications" },
    ],
    points: [
      "Les rendez-vous qui lui sont confiés, à confirmer ou à refuser",
      "Un calendrier partagé avec toute l'équipe",
      "Le suivi honoré ou manqué, et les e-mails au client",
    ],
  },
  {
    name: "Administrateur",
    lead: "Il règle l'outil et garde la vue d'ensemble.",
    nav: [
      { icon: BarChart3, label: "Tableau de bord", current: true },
      { icon: Users, label: "Utilisateurs" },
      { icon: KeyRound, label: "Rôles & permissions" },
      { icon: ListChecks, label: "Listes configurables" },
      { icon: SlidersHorizontal, label: "Champs personnalisés" },
      { icon: Building2, label: "Organisation" },
    ],
    points: [
      "Les chiffres de tous les agents, appels et rendez-vous",
      "Les comptes, les rôles et les permissions de chacun",
      "Le statut commercial final de chaque dossier",
    ],
  },
];

/** Trois rôles par défaut, présentés en onglets (flèches gauche/droite au clavier). */
export function RolesTabs() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const role = ROLES[active];

  function onKeyDown(e: KeyboardEvent) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (active + dir + ROLES.length) % ROLES.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Rôles par défaut"
        onKeyDown={onKeyDown}
        style={{ "--tab": active } as CSSProperties}
        className="relative grid max-w-xl grid-cols-3 rounded-lg border border-border bg-surface-subtle p-1"
      >
        {/* Curseur de l'onglet actif : glisse d'une colonne à l'autre. */}
        <span
          aria-hidden
          className="absolute bottom-1 left-1 top-1 w-[calc((100%-0.5rem)/3)] translate-x-[calc(var(--tab)*100%)] rounded-md bg-surface shadow-raised transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
        {ROLES.map((r, i) => (
          <button
            key={r.name}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`role-tab-${i}`}
            aria-selected={i === active}
            aria-controls="role-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "relative z-10 h-11 rounded-md px-1 text-[13px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 sm:text-sm",
              i === active ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div
        key={active}
        role="tabpanel"
        id="role-panel"
        aria-labelledby={`role-tab-${active}`}
        className="lp-swap mt-10 grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-center"
      >
        {/* Le rail de navigation de ce rôle, tel qu'il le voit une fois connecté. */}
        <ul aria-label={`Navigation : ${role.name}`} className="rounded-lg border border-border bg-surface p-2 shadow-flat">
          {role.nav.map(({ icon: Icon, label, current }) => (
            <li
              key={label}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm",
                current ? "bg-forest-50 font-medium text-ink" : "text-ink-muted",
              )}
            >
              <Icon aria-hidden strokeWidth={1.5} className={cn("h-4 w-4", current && "text-forest-600")} />
              {label}
            </li>
          ))}
        </ul>

        <div>
          <p className="font-display text-2xl leading-[1.15] text-ink [text-wrap:balance] sm:text-3xl">{role.lead}</p>
          <ul className="mt-8 space-y-4">
            {role.points.map((p) => (
              <li key={p} className="flex gap-3 text-lg leading-snug text-ink">
                <Check aria-hidden strokeWidth={2} className="mt-1 h-5 w-5 shrink-0 text-forest-600" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
