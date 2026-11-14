"use client";

import { AlarmClock, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";

const COLORS = [
  { value: "#D97706", name: "Ambre" },
  { value: "#16A34A", name: "Vert" },
  { value: "#DC2626", name: "Rouge" },
  { value: "#3B6E91", name: "Bleu" },
  { value: "#6B7280", name: "Gris" },
];

const INITIAL = { label: "À rappeler", color: "#D97706", recall: true };

const OTHERS = [
  { name: "Nadia Keller", wave: 2, status: "Ne répond pas", color: "#D97706" },
  { name: "Antoine Lefèvre", wave: 1, status: "Pas intéressé", color: "#DC2626" },
];

/**
 * Éditeur de statut jouable : libellé, couleur et règle de rappel, répercutés en direct dans
 * un extrait de file d'appels. Reprend ce que fait l'écran « Listes configurables » ; rien
 * n'est enregistré.
 */
export function RulesPlayground() {
  const [status, setStatus] = useState(INITIAL);
  const label = status.label.trim() || "Sans nom";
  const changed = status.label !== INITIAL.label || status.color !== INITIAL.color || status.recall !== INITIAL.recall;

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface shadow-raised md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Réglages */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="whitespace-nowrap text-sm font-semibold text-ink">Modifier un statut</p>
          <button
            type="button"
            onClick={() => setStatus(INITIAL)}
            disabled={!changed}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 disabled:invisible"
          >
            <RotateCcw aria-hidden strokeWidth={1.5} className="h-3.5 w-3.5" />
            Réinitialiser
          </button>
        </div>

        <label htmlFor="rule-label" className="mt-6 block text-xs font-medium text-ink-muted">
          Libellé
        </label>
        <input
          id="rule-label"
          type="text"
          value={status.label}
          maxLength={22}
          autoComplete="off"
          onChange={(e) => setStatus({ ...status, label: e.target.value })}
          className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-ink transition-colors duration-150 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/30"
        />

        <fieldset className="mt-6">
          <legend className="text-xs font-medium text-ink-muted">Couleur</legend>
          <div className="mt-2 flex gap-2.5">
            {COLORS.map((c) => {
              const on = c.value === status.color;
              return (
                <label key={c.value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="rule-color"
                    value={c.value}
                    checked={on}
                    onChange={() => setStatus({ ...status, color: c.value })}
                    className="peer sr-only"
                  />
                  <span
                    style={{ backgroundColor: c.value }}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-surface transition-transform duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ink",
                      on ? "scale-100 ring-2 ring-ink" : "scale-90 hover:scale-100",
                    )}
                  >
                    {on && <Check aria-hidden strokeWidth={2.5} className="h-4 w-4" />}
                  </span>
                  <span className="sr-only">{c.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-7 flex items-center justify-between gap-4 border-t border-border pt-6">
          <span id="rule-recall" className="text-sm text-ink">
            Nécessite une date de rappel
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={status.recall}
            aria-labelledby="rule-recall"
            onClick={() => setStatus({ ...status, recall: !status.recall })}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              status.recall ? "bg-forest-600" : "bg-ink-faint",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-1 top-1 h-5 w-5 rounded-full bg-surface transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                status.recall && "translate-x-5",
              )}
            />
          </button>
        </div>
      </div>

      {/* Résultat en direct */}
      <div className="border-t border-border bg-surface-subtle p-6 sm:p-8 md:border-l md:border-t-0">
        <p className="text-sm font-semibold text-ink">Ce que voit l&apos;agent</p>
        <ul className="mt-6 overflow-hidden rounded-md border border-border bg-surface">
          <li className="flex h-12 items-center gap-3 border-b border-border bg-forest-50 px-4 text-sm">
            <WaveBadge waveNumber={3} />
            <span className="min-w-0 flex-1 truncate font-medium text-ink">Julien Moreau</span>
            <StatusBadge key={status.color} label={label} color={status.color} className="lp-swap min-w-0 shrink-0 text-xs" />
          </li>
          {OTHERS.map((row) => (
            <li key={row.name} className="flex h-12 items-center gap-3 border-b border-border px-4 text-sm last:border-b-0">
              <WaveBadge waveNumber={row.wave} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name}</span>
              <StatusBadge label={row.status} color={row.color} className="shrink-0 text-xs" />
            </li>
          ))}
        </ul>

        <p key={String(status.recall)} aria-live="polite" className="lp-swap mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
          <AlarmClock aria-hidden strokeWidth={1.5} className={cn("mt-0.5 h-4 w-4 shrink-0", status.recall ? "text-forest-600" : "text-ink-faint")} />
          {status.recall ? (
            <span>
              En choisissant « <strong className="font-semibold text-ink">{label}</strong> », l&apos;agent doit fixer une date de rappel.
            </span>
          ) : (
            <span>
              « <strong className="font-semibold text-ink">{label}</strong> » se choisit sans date de rappel.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
