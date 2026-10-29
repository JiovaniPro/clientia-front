"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api/client";
import type { CustomFieldDefinitionDTO } from "@/lib/api/customFields";
import { getValues, listDefinitions, setValues, SUPPORTED_ENTITY_TYPE } from "@/lib/api/customFields";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUnsavedChangesGuard } from "@/lib/forms/useUnsavedChangesGuard";

type Values = Record<string, unknown>;

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

const NATIVE_INPUT_TYPE: Partial<Record<CustomFieldDefinitionDTO["fieldType"], string>> = {
  DATE: "date",
  EMAIL: "email",
  PHONE: "tel",
};

/**
 * Champs personnalisés CLIENT (définis sur /admin/custom-fields) affichés sur le dossier —
 * section à part, avec sa propre garde et son propre bouton (même règle §6.25 lot E que
 * les autres sections : enregistrer ici ne touche jamais la saisie des autres). Les
 * définitions viennent de /definitions (options, ordre, section, obligatoire) ; /values ne
 * porte que les valeurs. Rien n'est rendu tant qu'aucun champ actif n'existe.
 */
export function CustomFieldsSection({ clientId }: { clientId: string }) {
  const { authedFetch } = useAuth();
  const [definitions, setDefinitions] = useState<CustomFieldDefinitionDTO[] | null>(null);
  const [values, setValuesState] = useState<Values>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const guard = useUnsavedChangesGuard(values, undefined, definitions !== null);

  useEffect(() => {
    Promise.all([
      authedFetch((token) => listDefinitions(SUPPORTED_ENTITY_TYPE, token)),
      authedFetch((token) => getValues(SUPPORTED_ENTITY_TYPE, clientId, token)),
    ])
      .then(([defs, vals]) => {
        setValuesState(Object.fromEntries(vals.map((v) => [v.definitionId, v.value])));
        setDefinitions([...defs].sort((a, b) => a.order - b.order));
      })
      .catch(() => setError("Impossible de charger les champs personnalisés."));
  }, [authedFetch, clientId]);

  if (error && !definitions) return <p className="text-sm text-status-danger">{error}</p>;
  if (!definitions || definitions.length === 0) return null;
  const defs = definitions;

  const setValue = (id: string, value: unknown) => setValuesState((prev) => ({ ...prev, [id]: value }));

  async function handleSave() {
    setError(null);
    setSuccess(false);
    const missing = defs.filter((d) => d.isRequired && isEmpty(values[d.id]));
    if (missing.length > 0) {
      setError(`Obligatoire : ${missing.map((d) => d.label).join(", ")}.`);
      return;
    }
    setIsSaving(true);
    try {
      const payload = defs.map((d) => ({ definitionId: d.id, value: values[d.id] ?? null }));
      const saved = await authedFetch((token) => setValues(SUPPORTED_ENTITY_TYPE, clientId, payload, token));
      setValuesState(Object.fromEntries(saved.map((v) => [v.definitionId, v.value])));
      guard.markClean();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  // Regroupement par `section`, dans l'ordre de première apparition.
  const sections = [...new Set(defs.map((d) => d.section ?? ""))];

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
      <h2 className="font-display text-lg font-semibold text-ink">Informations complémentaires</h2>

      {sections.map((section) => (
        <div key={section} className="space-y-3">
          {section ? <h3 className="text-sm font-semibold text-ink-muted">{section}</h3> : null}
          <div className="grid grid-cols-2 gap-3">
            {defs
              .filter((d) => (d.section ?? "") === section)
              .map((d) => (
                <CustomFieldInput key={d.id} definition={d} value={values[d.id]} onChange={(v) => setValue(d.id, v)} />
              ))}
          </div>
        </div>
      ))}

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}
      {success ? <p className="text-sm text-status-success">Informations complémentaires mises à jour.</p> : null}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

function CustomFieldInput({
  definition: d,
  value,
  onChange,
}: {
  definition: CustomFieldDefinitionDTO;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = d.isRequired ? `${d.label} *` : d.label;
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";

  switch (d.fieldType) {
    case "TEXTAREA":
      return (
        <div className="col-span-2 flex flex-col gap-1.5">
          <label htmlFor={d.id} className="text-sm font-medium text-ink">
            {label}
          </label>
          <textarea
            id={d.id}
            rows={3}
            value={text}
            onChange={(e) => onChange(e.target.value || null)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600"
          />
        </div>
      );
    case "NUMBER":
      return (
        <Input
          label={label}
          type="number"
          value={text}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "SELECT":
      return (
        <Select label={label} value={text} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {(d.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case "MULTISELECT": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(d.options ?? []).map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={selected.includes(o)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))}
                />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "CHECKBOX":
      return (
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
      );
    default:
      // TEXT, DATE, EMAIL, PHONE : champ natif du bon type.
      return (
        <Input
          label={label}
          type={NATIVE_INPUT_TYPE[d.fieldType] ?? "text"}
          value={text}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
  }
}
