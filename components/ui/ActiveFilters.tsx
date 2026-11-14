import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ActiveFilter {
  key: string;
  /** Texte de la pastille, ex. "Type : Relance". */
  label: string;
  onRemove: () => void;
}

/** Pastilles des filtres actifs + "Réinitialiser les filtres". Rien n'est rendu sans filtre actif. */
export function ActiveFilters({ filters, onReset }: { filters: ActiveFilter[]; onReset: () => void }) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtres actifs">
      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-md border border-forest-600/30 bg-forest-50 py-0.5 pl-2 pr-1 text-xs text-forest-600"
        >
          {f.label}
          <button
            type="button"
            onClick={f.onRemove}
            aria-label={`Retirer le filtre ${f.label}`}
            className="rounded-sm p-0.5 hover:bg-forest-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      <Button size="sm" variant="ghost" onClick={onReset}>
        Réinitialiser les filtres
      </Button>
    </div>
  );
}
