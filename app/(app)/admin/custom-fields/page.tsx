"use client";

import {
  Asterisk,
  CalendarDays,
  Hash,
  ListChecks,
  Mail,
  Pencil,
  Phone,
  Plus,
  SlidersHorizontal,
  SquareCheck,
  SquareChevronDown,
  TextAlignStart,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CustomFieldFormModal } from "@/components/admin/CustomFieldFormModal";
import { AdminFeedback } from "@/components/admin/kit/Feedback";
import { AdminHeader, RowsSkeleton, SearchField, StatTile } from "@/components/admin/kit/Controls";
import { Switch } from "@/components/admin/kit/Switch";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/ListStates";
import { ApiError } from "@/lib/api/client";
import type { CustomFieldDefinitionDTO, CustomFieldType } from "@/lib/api/customFields";
import { listDefinitions, SUPPORTED_ENTITY_TYPE, updateDefinition } from "@/lib/api/customFields";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

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

const FIELD_TYPE_ICONS: Record<CustomFieldType, LucideIcon> = {
  TEXT: Type,
  TEXTAREA: TextAlignStart,
  NUMBER: Hash,
  DATE: CalendarDays,
  SELECT: SquareChevronDown,
  MULTISELECT: ListChecks,
  CHECKBOX: SquareCheck,
  EMAIL: Mail,
  PHONE: Phone,
};

const NO_SECTION = "Sans section";
const OPTIONS_SHOWN = 4;

/**
 * Écran d'administration §5.23 (sous-lots A + B + C — lecture, création, édition,
 * activer/désactiver). Jamais de suppression physique depuis "Désactiver" — pose
 * `isActive: false`, qui retire le champ des formulaires de saisie sans toucher aux
 * valeurs déjà écrites sur des dossiers clients (même logique que §5.22).
 *
 * Présentation : les champs regroupés par section, chacun avec l'icône de son type, son caractère obligatoire,
 * ses choix éventuels et un interrupteur actif/inactif.
 */
export default function AdminCustomFieldsPage() {
  const { authedFetch } = useAuth();

  const [definitions, setDefinitions] = useState<CustomFieldDefinitionDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; definition: CustomFieldDefinitionDTO } | null>(
    null,
  );
  const [deactivateTarget, setDeactivateTarget] = useState<CustomFieldDefinitionDTO | null>(null);

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
      setDeactivateTarget(null);
    }
  }

  /** Seule la désactivation passe par une confirmation — réactiver n'a rien de sensible (§6.23). */
  function handleToggleActiveClick(definition: CustomFieldDefinitionDTO) {
    if (definition.isActive) {
      setDeactivateTarget(definition);
    } else {
      handleToggleActive(definition);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visible = definitions
    .filter((d) => !normalizedQuery || `${d.label} ${d.key} ${d.section ?? ""} ${FIELD_TYPE_LABELS[d.fieldType]}`.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.order - b.order);
  // Sections dans l'ordre d'apparition de leur premier champ ; « Sans section » en dernier.
  const sections = [...new Set(visible.map((d) => d.section ?? NO_SECTION))].sort(
    (a, b) => Number(a === NO_SECTION) - Number(b === NO_SECTION),
  );
  const required = definitions.filter((d) => d.isRequired && d.isActive).length;
  const inactive = definitions.filter((d) => !d.isActive).length;

  return (
    <div className="space-y-6 p-6">
      <AdminHeader
        parent="Administration"
        title="Champs personnalisés"
        description="Des champs en plus sur le dossier client, propres à votre activité. Désactiver un champ le retire des formulaires sans toucher aux valeurs déjà saisies."
        action={
          <Button onClick={() => setModal({ mode: "create" })}>
            <Plus size={16} aria-hidden />
            Nouveau champ
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<SlidersHorizontal size={20} />} label="Champs" value={isLoading ? "–" : definitions.length} />
        <StatTile icon={<Asterisk size={20} />} label="Obligatoires" value={isLoading ? "–" : required} />
        <StatTile icon={<Pencil size={20} />} label="Désactivés" value={isLoading ? "–" : inactive} />
      </div>

      {definitions.length > 5 ? (
        <SearchField value={query} onChange={setQuery} label="Rechercher un champ" placeholder="Libellé, clé, section, type…" />
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          <RowsSkeleton />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          {normalizedQuery ? (
            <EmptyState title={`Aucun champ ne correspond à « ${query} ».`} />
          ) : (
            <EmptyState
              title="Aucun champ personnalisé."
              description="Ajoutez un champ (texte, date, choix…) : il apparaîtra sur chaque dossier client."
              action={
                <Button size="sm" onClick={() => setModal({ mode: "create" })}>
                  Nouveau champ
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const fields = visible.filter((d) => (d.section ?? NO_SECTION) === section);
            return (
              <section key={section} aria-label={`Section ${section}`}>
                <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink">
                  {section}
                  <span className="font-mono text-xs font-normal text-ink-faint">{fields.length}</span>
                </h2>
                <ul className="divide-y divide-border rounded-lg border border-border bg-surface shadow-flat">
                  {fields.map((d) => {
                    const Icon = FIELD_TYPE_ICONS[d.fieldType];
                    return (
                      <li
                        key={d.id}
                        className="app-rise group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-subtle/60"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                            d.isActive ? "bg-forest-50 text-forest-600" : "bg-surface-subtle text-ink-faint",
                          )}
                        >
                          <Icon size={18} strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1 basis-56">
                          <p className={cn("flex items-center gap-2 text-sm font-semibold", d.isActive ? "text-ink" : "text-ink-muted")}>
                            <span className="truncate">{d.label}</span>
                            {d.isRequired ? (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-terracotta-500/10 px-1.5 py-0.5 text-[11px] font-medium text-terracotta-600">
                                <Asterisk size={10} aria-hidden /> Obligatoire
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-ink-muted">
                            {FIELD_TYPE_LABELS[d.fieldType]} · <span className="font-mono text-ink-faint">{d.key}</span>
                          </p>
                        </div>
                        {d.options && d.options.length > 0 ? (
                          <ul aria-label="Choix proposés" className="flex max-w-xs flex-wrap gap-1.5">
                            {d.options.slice(0, OPTIONS_SHOWN).map((o) => (
                              <li key={o} className="max-w-[9rem] truncate rounded-sm bg-surface-subtle px-2 py-0.5 text-xs text-ink-muted">
                                {o}
                              </li>
                            ))}
                            {d.options.length > OPTIONS_SHOWN ? (
                              <li className="px-1 py-0.5 text-xs text-ink-faint">+{d.options.length - OPTIONS_SHOWN}</li>
                            ) : null}
                          </ul>
                        ) : null}
                        <div className="flex w-24 items-center gap-2">
                          <Switch
                            checked={d.isActive}
                            onChange={() => handleToggleActiveClick(d)}
                            label={`Champ « ${d.label} »`}
                            disabled={pendingId === d.id}
                            title={d.isActive ? "Désactiver le champ" : "Réactiver le champ"}
                          />
                          <span className={cn("text-xs font-medium", d.isActive ? "text-forest-600" : "text-ink-muted")}>{d.isActive ? "Actif" : "Inactif"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setModal({ mode: "edit", definition: d })}
                          aria-label={`Modifier « ${d.label} »`}
                          title="Modifier"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-forest-600 transition-colors hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {modal ? (
        <CustomFieldFormModal
          definition={modal.mode === "edit" ? modal.definition : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deactivateTarget ? (
        <ConfirmModal
          title="Désactiver ce champ"
          message={`Désactiver « ${deactivateTarget.label} » ? Il disparaîtra des formulaires de saisie — les valeurs déjà écrites sur les dossiers clients restent intactes.`}
          confirmLabel="Désactiver"
          onConfirm={() => handleToggleActive(deactivateTarget)}
          onClose={() => setDeactivateTarget(null)}
          isConfirming={pendingId === deactivateTarget.id}
        />
      ) : null}

      <AdminFeedback notice={notice} error={error} onDismissNotice={() => setNotice(null)} onDismissError={() => setError(null)} />
    </div>
  );
}
