import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/** Erreur de chargement d'une liste, avec relance. `role="alert"` : annoncée dès qu'elle apparaît. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-6">
      <p className="text-sm text-status-danger">{message}</p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        <RotateCw size={14} aria-hidden />
        Réessayer
      </Button>
    </div>
  );
}

/** État vide guidé : un titre, une explication facultative, et l'action qui remplit la liste quand elle existe. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Squelette de tableau du PREMIER chargement — lignes de la même hauteur qu'une vraie ligne (py-2.5 + text-sm).
 * Les rechargements suivants (page, filtre) gardent les lignes déjà affichées, estompées : rien ne saute.
 */
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Chargement…" className="relative">
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: columns }, (_, c) => (
          <div key={c} className="h-3 flex-1 animate-pulse rounded-sm bg-surface-subtle" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className="h-4 flex-1 animate-pulse rounded-sm bg-surface-subtle" />
          ))}
        </div>
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
