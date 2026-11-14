"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/cn";

/** Champ de recherche filtrant en direct : croix pour effacer, Échap pour vider. */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <Search aria-hidden size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Puce de filtre : point de couleur facultatif, libellé, compteur. */
export function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  color?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        active ? "border-forest-600 bg-forest-50 text-ink" : "border-border bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
        !active && count === 0 && "opacity-60",
      )}
    >
      {color ? <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
      {label}
      {count !== undefined ? (
        <span className={cn("font-mono text-xs tabular-nums", active ? "text-forest-600" : "text-ink-faint")}>{count}</span>
      ) : null}
    </button>
  );
}

/** Choix exclusif à deux ou trois options (ex. Utilisateurs / Supprimés). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1 rounded-md border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
            value === o.value ? "bg-forest-600 text-white dark:text-cream" : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className="font-mono text-xs tabular-nums opacity-80">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Tuile de chiffre en tête de page : le nombre en grand, son libellé en dessous. */
export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-surface px-5 py-4 shadow-flat">
      {icon ? (
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-forest-50 text-forest-600">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-1.5 truncate text-sm text-ink-muted">{label}</p>
        {hint ? <p className="truncate text-xs text-ink-faint">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Intitulé de page d'administration : titre, phrase d'aide, action principale. */
export function AdminHeader({
  parent,
  title,
  description,
  action,
}: {
  parent: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="font-display text-2xl text-ink-muted">{parent}</span>
          <span aria-hidden className="text-xl text-ink-faint">
            /
          </span>
          <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}

/** Lignes fantômes du premier chargement. */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement…" className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface-subtle" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded-sm bg-surface-subtle" />
            <div className="h-3 w-1/2 animate-pulse rounded-sm bg-surface-subtle" />
          </div>
          <div className="h-6 w-11 animate-pulse rounded-full bg-surface-subtle" />
        </div>
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
