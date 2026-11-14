import type { ReactNode } from "react";

/**
 * Titre de page en fil : « Catégorie / Titre » sur une ligne — la catégorie grisée, le titre en gras.
 * Hiérarchie purement visuelle (aucune route parente). Seul le titre est dans le <h1> : son nom accessible
 * reste « À appeler », pas « Prospection / À appeler ».
 */
export function PageTitle({ parent, children }: { parent: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5">
      <span className="font-display text-2xl text-ink-muted">{parent}</span>
      <span aria-hidden className="text-xl text-ink-faint">
        /
      </span>
      <h1 className="font-display text-2xl font-bold text-ink">{children}</h1>
    </div>
  );
}
