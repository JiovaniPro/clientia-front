import { X } from "lucide-react";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface StatusMultiFilterProps {
  statuses: ConfigurableListItemDTO[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
}

/**
 * §5.4 — filtre multi-statut de l'écran "Aujourd'hui" UNIQUEMENT. Pattern volontairement
 * isolé : Journal et Calls gardent leur Select mono-valeur (décision actée au brief §5.4,
 * pas un oubli — ne pas "harmoniser" sans décision produit). Dropdown natif <details> +
 * cases à cocher (aucun multi-select n'existait dans l'app), puces = StatusBadge.
 */
export function StatusMultiFilter({ statuses, selectedKeys, onChange }: StatusMultiFilterProps) {
  const toggle = (key: string) =>
    onChange(selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]);
  const selected = statuses.filter((s) => selectedKeys.includes(s.key));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">Statut</span>
      <div className="flex flex-wrap items-center gap-2">
        <details className="relative">
          <summary className="flex h-10 w-48 cursor-pointer list-none items-center rounded-md border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest-600">
            {selected.length === 0 ? "Tous les statuts" : `${selected.length} statut${selected.length > 1 ? "s" : ""}`}
          </summary>
          <ul className="absolute z-10 mt-1 max-h-64 w-64 overflow-auto rounded-md border border-border bg-surface p-1 shadow-flat">
            {statuses.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-subtle">
                  <input type="checkbox" checked={selectedKeys.includes(s.key)} onChange={() => toggle(s.key)} />
                  <StatusBadge label={s.label} color={s.color} />
                </label>
              </li>
            ))}
          </ul>
        </details>
        {selected.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.key)}
            aria-label={`Retirer le statut ${s.label}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2 py-1 hover:border-ink-muted"
          >
            <StatusBadge label={s.label} color={s.color} />
            <X size={14} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
