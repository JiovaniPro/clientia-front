"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CustomFieldFormModal } from "@/components/admin/CustomFieldFormModal";
import { ApiError } from "@/lib/api/client";
import type { CustomFieldDefinitionDTO, CustomFieldType } from "@/lib/api/customFields";
import { listDefinitions, SUPPORTED_ENTITY_TYPE, updateDefinition } from "@/lib/api/customFields";
import { useAuth } from "@/lib/auth/AuthContext";

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

/**
 * Écran d'administration §5.23 (sous-lots A + B + C — lecture, création, édition,
 * activer/désactiver). Jamais de suppression physique depuis "Désactiver" — pose
 * `isActive: false`, qui retire le champ des formulaires de saisie sans toucher aux
 * valeurs déjà écrites sur des dossiers clients (même logique que §5.22).
 */
export default function AdminCustomFieldsPage() {
  const { authedFetch } = useAuth();

  const [definitions, setDefinitions] = useState<CustomFieldDefinitionDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; definition: CustomFieldDefinitionDTO } | null>(
    null,
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDefinitions(await authedFetch((token) => listDefinitions(SUPPORTED_ENTITY_TYPE, token, true)));
    } catch {
      setError("Impossible de charger les champs personnalisés.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleSaved(saved: CustomFieldDefinitionDTO) {
    const wasCreate = modal?.mode === "create";
    setModal(null);
    setDefinitions((prev) => {
      const exists = prev.some((d) => d.id === saved.id);
      const next = exists ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved];
      return next.sort((a, b) => a.order - b.order);
    });
    setNotice(wasCreate ? `« ${saved.label} » créé.` : "Champ mis à jour.");
  }

  async function handleToggleActive(definition: CustomFieldDefinitionDTO) {
    setError(null);
    setNotice(null);
    setPendingId(definition.id);
    try {
      const updated = await authedFetch((token) =>
        updateDefinition(definition.id, { isActive: !definition.isActive }, token),
      );
      setDefinitions((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setNotice(updated.isActive ? `« ${updated.label} » réactivé.` : `« ${updated.label} » désactivé.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
    }
  }

  const columns: AdminTableColumn<CustomFieldDefinitionDTO>[] = [
    { header: "Libellé", className: "text-ink", cell: (d) => d.label },
    { header: "Clé", className: "font-mono text-xs text-ink-faint", cell: (d) => d.key },
    { header: "Type", className: "text-ink-muted", cell: (d) => FIELD_TYPE_LABELS[d.fieldType] },
    { header: "Section", className: "text-ink-muted", cell: (d) => d.section ?? "—" },
    { header: "Obligatoire", className: "text-ink-muted", cell: (d) => (d.isRequired ? "Oui" : "—") },
    { header: "Ordre", className: "text-ink-muted", cell: (d) => d.order },
    {
      header: "Statut",
      cell: (d) => (
        <StatusBadge
          label={d.isActive ? "Actif" : "Inactif"}
          color={d.isActive ? "var(--color-forest-600)" : "var(--color-ink-faint)"}
        />
      ),
    },
    {
      header: "",
      className: "text-right",
      cell: (d) => (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="text-xs font-medium text-forest-600 hover:underline"
            onClick={() => setModal({ mode: "edit", definition: d })}
          >
            Modifier
          </button>
          <button
            type="button"
            className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
            onClick={() => handleToggleActive(d)}
            disabled={pendingId === d.id}
          >
            {d.isActive ? "Désactiver" : "Réactiver"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
          <h1 className="font-display text-2xl font-bold text-ink">Champs personnalisés</h1>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>Nouveau champ</Button>
      </header>

      <p className="text-sm text-ink-muted">
        Champs additionnels affichés sur les dossiers clients, en plus des champs standards. Désactiver un champ le
        retire des formulaires de saisie sans toucher aux valeurs déjà écrites.
      </p>

      {notice ? (
        <p className="rounded-md border border-forest-600/30 bg-forest-600/10 px-3 py-2 text-sm text-forest-600">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <AdminTable
        columns={columns}
        rows={definitions}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        emptyMessage="Aucun champ personnalisé."
      />

      {modal ? (
        <CustomFieldFormModal
          definition={modal.mode === "edit" ? modal.definition : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
