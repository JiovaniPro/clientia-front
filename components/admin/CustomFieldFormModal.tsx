"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import type { CustomFieldDefinitionDTO, CustomFieldType } from "@/lib/api/customFields";
import { createDefinition, SUPPORTED_ENTITY_TYPE, updateDefinition } from "@/lib/api/customFields";
import { useAuth } from "@/lib/auth/AuthContext";

interface CustomFieldFormModalProps {
  /** Présent = édition, absent = création. */
  definition?: CustomFieldDefinitionDTO;
  onClose: () => void;
  onSaved: (definition: CustomFieldDefinitionDTO) => void;
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Texte court",
  TEXTAREA: "Texte long",
  NUMBER: "Nombre",
  DATE: "Date",
  SELECT: "Choix unique",
  MULTISELECT: "Choix multiple",
  CHECKBOX: "Case à cocher",
  EMAIL: "E-mail",
  PHONE: "Téléphone",
};

const CHOICE_FIELD_TYPES: CustomFieldType[] = ["SELECT", "MULTISELECT"];

/**
 * §5.23 sous-lots A + B — création et édition. `key`, `entityType` et `fieldType`
 * ne sont jamais modifiables en édition : absents du schéma backend
 * `updateCustomFieldDefinitionSchema` — changer le type d'un champ déjà rempli sur
 * des dossiers clients transformerait des valeurs existantes en données incohérentes.
 * Activer/désactiver suivra séparément (sous-lot C).
 */
export function CustomFieldFormModal({ definition, onClose, onSaved }: CustomFieldFormModalProps) {
  const { authedFetch } = useAuth();
  const isEdit = Boolean(definition);

  const [key, setKey] = useState(definition?.key ?? "");
  const [label, setLabel] = useState(definition?.label ?? "");
  const [fieldType, setFieldType] = useState<CustomFieldType>(definition?.fieldType ?? "TEXT");
  const [options, setOptions] = useState<string[]>(
    definition?.options && definition.options.length > 0 ? definition.options : [""],
  );
  const [isRequired, setIsRequired] = useState(definition?.isRequired ?? false);
  const [section, setSection] = useState(definition?.section ?? "");
  const [order, setOrder] = useState(definition?.order ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isChoiceType = CHOICE_FIELD_TYPES.includes(fieldType);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (!key.trim() || !label.trim()) {
      setError("La clé et le libellé sont obligatoires.");
      return;
    }
    const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (isChoiceType && cleanedOptions.length === 0) {
      setError("Ce type de champ nécessite au moins une option.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && definition) {
        const updated = await authedFetch((token) =>
          updateDefinition(
            definition.id,
            {
              label,
              options: isChoiceType ? cleanedOptions : undefined,
              isRequired,
              order,
              section: section || undefined,
            },
            token,
          ),
        );
        onSaved(updated);
      } else {
        const created = await authedFetch((token) =>
          createDefinition(
            {
              entityType: SUPPORTED_ENTITY_TYPE,
              key: key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
              label,
              fieldType,
              options: isChoiceType ? cleanedOptions : undefined,
              isRequired,
              order,
              section: section || undefined,
            },
            token,
          ),
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
    <Modal title={isEdit ? "Modifier le champ personnalisé" : "Nouveau champ personnalisé"} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-ink-muted">
          Applicable aux dossiers clients — aucun autre type d&apos;entité n&apos;est pris en charge pour l&apos;instant.
        </p>

        <Input
          label="Clé (identifiant stable, non modifiable ensuite)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={isEdit}
          required
        />
        <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />

        <Select
          label="Type de champ"
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
          disabled={isEdit}
        >
          {Object.entries(FIELD_TYPE_LABELS).map(([value, fieldLabel]) => (
            <option key={value} value={value}>
              {fieldLabel}
            </option>
          ))}
        </Select>
        {isEdit ? (
          <p className="-mt-2 text-xs text-ink-faint">
            Le type ne peut pas être changé après création (des valeurs peuvent déjà exister sur des dossiers).
          </p>
        ) : null}

        {isChoiceType ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Options</p>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input value={option} onChange={(e) => updateOption(index, e.target.value)} className="flex-1" />
                  <button
                    type="button"
                    className="text-xs font-medium text-status-danger hover:underline"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 1}
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-xs font-medium text-forest-600 hover:underline" onClick={addOption}>
              + Ajouter une option
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Section (optionnel)" value={section} onChange={(e) => setSection(e.target.value)} />
          <Input label="Ordre d'affichage" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
          Champ obligatoire
        </label>

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
