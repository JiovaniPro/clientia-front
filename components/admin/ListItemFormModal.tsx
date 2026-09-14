"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import type { BehaviorFlagDTO, ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { createListItem, updateListItem } from "@/lib/api/configurableLists";
import { listKeyLabel } from "@/lib/nav/listKeyLabels";
import { useAuth } from "@/lib/auth/AuthContext";

interface ListItemFormModalProps {
  /** Liste ciblée — fixe pour toute la durée de la modale, jamais un champ libre :
   * ajouter une valeur se fait toujours DANS une liste existante, pas dans une
   * catégorie inventée à la volée (voir configurableListsCatalog.ts côté backend). */
  listKey: string;
  /** Présent = édition, absent = création. */
  item?: ConfigurableListItemDTO;
  behaviorFlags: BehaviorFlagDTO[];
  onClose: () => void;
  onSaved: (item: ConfigurableListItemDTO) => void;
}

export function ListItemFormModal({ listKey, item, behaviorFlags, onClose, onSaved }: ListItemFormModalProps) {
  const { authedFetch } = useAuth();
  const isEdit = Boolean(item);

  const [key, setKey] = useState(item?.key ?? "");
  const [label, setLabel] = useState(item?.label ?? "");
  const [color, setColor] = useState(item?.color ?? "#6B7280");
  const [order, setOrder] = useState(item?.order ?? 0);
  const [isDefault, setIsDefault] = useState(item?.isDefault ?? false);
  const [flags, setFlags] = useState<Set<string>>(
    new Set(Object.entries(item?.metadata ?? {}).filter(([, v]) => v).map(([k]) => k)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleFlag(flagKey: string) {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flagKey)) next.delete(flagKey);
      else next.add(flagKey);
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    if (!key.trim() || !label.trim()) {
      setError("La clé et le libellé sont obligatoires.");
      return;
    }
    setIsSubmitting(true);
    try {
      const metadata = Object.fromEntries(Array.from(flags).map((k) => [k, true]));
      if (isEdit && item) {
        const updated = await authedFetch((token) =>
          updateListItem(item.id, { label, color, order, isDefault, metadata }, token),
        );
        onSaved(updated);
      } else {
        const created = await authedFetch((token) =>
          createListItem({ listKey, key, label, color, order, isDefault, metadata }, token),
        );
        onSaved(created);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? "Modifier la valeur" : "Nouvelle valeur"} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-ink-muted">
          Liste : <span className="font-medium text-ink">{listKeyLabel(listKey)}</span>
        </p>

        <Input
          label="Clé (identifiant stable, non modifiable ensuite)"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
          disabled={isEdit}
          required
        />
        <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Input
            label="Ordre d'affichage"
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Couleur</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 rounded-md border border-border bg-surface"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Valeur par défaut de cette liste
        </label>

        {behaviorFlags.length > 0 ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Comportement</p>
            <div className="space-y-1.5 rounded-md border border-border p-3">
              {behaviorFlags.map((flag) => (
                <label key={flag.key} className="flex items-start gap-2 text-sm text-ink-muted">
                  <input type="checkbox" className="mt-0.5" checked={flags.has(flag.key)} onChange={() => toggleFlag(flag.key)} />
                  {flag.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
