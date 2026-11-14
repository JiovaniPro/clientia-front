"use client";

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListItemFormModal } from "@/components/admin/ListItemFormModal";
import { AdminFeedback } from "@/components/admin/kit/Feedback";
import { AdminHeader, RowsSkeleton, SearchField } from "@/components/admin/kit/Controls";
import { RowMenu } from "@/components/admin/kit/RowMenu";
import { Switch } from "@/components/admin/kit/Switch";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/ListStates";
import { ApiError } from "@/lib/api/client";
import type { BehaviorFlagDTO, ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { deleteListItem, getBehaviorFlagsCatalog, listAllConfigurableLists, updateListItem } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";
import { listKeyLabel } from "@/lib/nav/listKeyLabels";

/** Au-delà, un champ de recherche aide à retrouver une valeur. */
const SEARCH_THRESHOLD = 6;

/**
 * Écran d'administration §5.22 (sous-lots A + B + C — lecture, désactivation,
 * création, édition, suppression). "Désactiver" (isActive:false) reste la voie
 * normale pour retirer une valeur déjà utilisée des nouvelles saisies sans toucher
 * à l'historique ; "Supprimer" est une suppression physique, bloquée côté backend
 * si la valeur est encore référencée par un enregistrement existant ou si elle est
 * la valeur par défaut de sa liste (message backend affiché tel quel, jamais re-deviné ici).
 *
 * Présentation : à gauche les listes (avec leur nombre de valeurs actives), à droite les valeurs de la liste
 * choisie — pastille de couleur, comportements activés, interrupteur actif/inactif.
 */
export default function AdminConfigurableListsPage() {
  const { authedFetch } = useAuth();

  const [grouped, setGrouped] = useState<Record<string, ConfigurableListItemDTO[]>>({});
  const [behaviorFlagsCatalog, setBehaviorFlagsCatalog] = useState<Record<string, BehaviorFlagDTO[]>>({});
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; item: ConfigurableListItemDTO } | null>(
    null,
  );
  const [deactivateTarget, setDeactivateTarget] = useState<ConfigurableListItemDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConfigurableListItemDTO | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, flags] = await Promise.all([
        authedFetch((token) => listAllConfigurableLists(token)),
        authedFetch((token) => getBehaviorFlagsCatalog(token)),
      ]);
      setGrouped(data);
      setBehaviorFlagsCatalog(flags);
      setSelectedKey((prev) => prev || Object.keys(data)[0] || "");
    } catch {
      setError("Impossible de charger les listes configurables.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const listKeys = Object.keys(grouped).sort((a, b) => listKeyLabel(a).localeCompare(listKeyLabel(b), "fr"));
  const items = useMemo(
    () => [...(grouped[selectedKey] ?? [])].sort((a, b) => a.order - b.order),
    [grouped, selectedKey],
  );
  const flags = behaviorFlagsCatalog[selectedKey] ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = items.filter((i) => !normalizedQuery || `${i.label} ${i.key}`.toLowerCase().includes(normalizedQuery));
  const activeCount = items.filter((i) => i.isActive).length;

  function upsertItem(updated: ConfigurableListItemDTO) {
    setGrouped((prev) => {
      const list = prev[updated.listKey] ?? [];
      const exists = list.some((i) => i.id === updated.id);
      return { ...prev, [updated.listKey]: exists ? list.map((i) => (i.id === updated.id ? updated : i)) : [...list, updated] };
    });
  }

  async function handleToggleActive(item: ConfigurableListItemDTO) {
    setError(null);
    setNotice(null);
    setPendingId(item.id);
    try {
      const updated = await authedFetch((token) => updateListItem(item.id, { isActive: !item.isActive }, token));
      upsertItem(updated);
      setNotice(updated.isActive ? `« ${updated.label} » réactivé.` : `« ${updated.label} » désactivé.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
      setDeactivateTarget(null);
    }
  }

  /** Seule la désactivation passe par une confirmation — réactiver n'a rien de sensible (§6.22). */
  function handleToggleActiveClick(item: ConfigurableListItemDTO) {
    if (item.isActive) {
      setDeactivateTarget(item);
    } else {
      handleToggleActive(item);
    }
  }

  function handleSaved(saved: ConfigurableListItemDTO) {
    setModal(null);
    upsertItem(saved);
    setNotice(modal?.mode === "create" ? `« ${saved.label} » créé.` : "Valeur mise à jour.");
  }

  async function handleDelete(item: ConfigurableListItemDTO) {
    setError(null);
    setNotice(null);
    setPendingId(item.id);
    try {
      await authedFetch((token) => deleteListItem(item.id, token));
      setGrouped((prev) => ({
        ...prev,
        [item.listKey]: (prev[item.listKey] ?? []).filter((i) => i.id !== item.id),
      }));
      setNotice(`« ${item.label} » supprimé.`);
    } catch (err) {
      // Le garde-fou vient de la contrainte de clé étrangère côté base (valeur
      // encore référencée) ou du statut "par défaut" — message backend affiché tel quel.
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <AdminHeader
        parent="Administration"
        title="Listes configurables"
        description="Les choix proposés dans vos menus déroulants : statuts, pays, civilités… Désactiver une valeur la retire des nouvelles saisies sans toucher à l'historique."
        action={
          <Button onClick={() => setModal({ mode: "create" })} disabled={!selectedKey}>
            <Plus size={16} aria-hidden />
            Nouvelle valeur
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Les listes : colonne sur grand écran, ligne défilante sinon. */}
        <nav aria-label="Listes" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {isLoading
              ? Array.from({ length: 6 }, (_, i) => <li key={i} className="h-11 w-40 shrink-0 animate-pulse rounded-md bg-surface-subtle lg:w-full" />)
              : listKeys.map((key) => {
                  const list = grouped[key] ?? [];
                  const active = key === selectedKey;
                  return (
                    <li key={key} className="shrink-0 lg:shrink">
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => {
                          setSelectedKey(key);
                          setQuery("");
                        }}
                        className={cn(
                          "flex h-11 w-full items-center justify-between gap-3 rounded-md border px-3.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                          active
                            ? "border-forest-600 bg-forest-50 text-ink"
                            : "border-transparent text-ink-muted hover:bg-surface-subtle hover:text-ink",
                        )}
                      >
                        <span className="truncate">{listKeyLabel(key)}</span>
                        <span className={cn("font-mono text-xs tabular-nums", active ? "text-forest-600" : "text-ink-faint")}>
                          {list.filter((i) => i.isActive).length}
                        </span>
                      </button>
                    </li>
                  );
                })}
          </ul>
        </nav>

        <section aria-label={selectedKey ? listKeyLabel(selectedKey) : "Valeurs"} className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-ink">{selectedKey ? listKeyLabel(selectedKey) : "—"}</h2>
              <p className="text-sm text-ink-muted">
                {items.length} valeur{items.length > 1 ? "s" : ""}, dont {activeCount} active{activeCount > 1 ? "s" : ""}.
              </p>
            </div>
            {items.length > SEARCH_THRESHOLD ? (
              <SearchField value={query} onChange={setQuery} label="Rechercher une valeur" placeholder="Libellé ou clé…" className="max-w-xs" />
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-flat">
            {isLoading ? (
              <RowsSkeleton />
            ) : visibleItems.length === 0 ? (
              normalizedQuery ? (
                <EmptyState title={`Aucune valeur ne correspond à « ${query} ».`} />
              ) : (
                <EmptyState
                  title="Aucune valeur dans cette liste."
                  description="Ajoutez la première valeur pour qu'elle apparaisse dans vos menus déroulants."
                  action={
                    <Button size="sm" onClick={() => setModal({ mode: "create" })}>
                      Nouvelle valeur
                    </Button>
                  }
                />
              )
            ) : (
              <ul className="divide-y divide-border">
                {visibleItems.map((item) => {
                  const enabledFlags = flags.filter((f) => item.metadata?.[f.key]);
                  return (
                    <li
                      key={item.id}
                      className="app-rise group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-subtle/60"
                    >
                      <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-ink-faint" title="Ordre d'affichage">
                        {item.order}
                      </span>
                      <div className="min-w-0 flex-1 basis-56">
                        <p className={cn("flex items-center gap-2.5 text-sm font-semibold", item.isActive ? "text-ink" : "text-ink-muted")}>
                          {item.color ? (
                            <span aria-hidden className={cn("h-3.5 w-3.5 shrink-0 rounded-full", !item.isActive && "opacity-40")} style={{ backgroundColor: item.color }} />
                          ) : null}
                          <span className="truncate">{item.label}</span>
                          {item.isDefault ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-forest-50 px-1.5 py-0.5 text-[11px] font-medium text-forest-600">
                              <Star size={11} aria-hidden /> Par défaut
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-ink-faint">{item.key}</p>
                      </div>
                      {enabledFlags.length > 0 ? (
                        <ul aria-label="Comportements" className="flex flex-wrap gap-1.5">
                          {enabledFlags.map((f) => (
                            <li key={f.key} className="rounded-sm bg-surface-subtle px-2 py-0.5 text-xs text-ink-muted">
                              {f.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="flex w-24 items-center gap-2">
                        <Switch
                          checked={item.isActive}
                          onChange={() => handleToggleActiveClick(item)}
                          label={`Valeur « ${item.label} »`}
                          disabled={pendingId === item.id}
                          title={item.isActive ? "Désactiver la valeur" : "Réactiver la valeur"}
                        />
                        <span className={cn("text-xs font-medium", item.isActive ? "text-forest-600" : "text-ink-muted")}>{item.isActive ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setModal({ mode: "edit", item })}
                          aria-label={`Modifier « ${item.label} »`}
                          title="Modifier"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-forest-600 transition-colors hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                        <RowMenu
                          label={`Plus d'actions pour « ${item.label} »`}
                          items={[
                            {
                              label: "Supprimer la valeur",
                              icon: Trash2,
                              danger: true,
                              onSelect: () => setDeleteTarget(item),
                              disabled: pendingId === item.id || item.isDefault,
                              hint: item.isDefault ? "La valeur par défaut d'une liste ne peut pas être supprimée" : undefined,
                            },
                          ]}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {modal && selectedKey ? (
        <ListItemFormModal
          listKey={selectedKey}
          item={modal.mode === "edit" ? modal.item : undefined}
          behaviorFlags={behaviorFlagsCatalog[selectedKey] ?? []}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deactivateTarget ? (
        <ConfirmModal
          title="Désactiver cette valeur"
          message={`Désactiver « ${deactivateTarget.label} » ? Elle disparaîtra des listes déroulantes pour les nouvelles saisies — l'historique existant reste intact.`}
          confirmLabel="Désactiver"
          onConfirm={() => handleToggleActive(deactivateTarget)}
          onClose={() => setDeactivateTarget(null)}
          isConfirming={pendingId === deactivateTarget.id}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Supprimer cette valeur"
          message={`Supprimer « ${deleteTarget.label} » ? Cette action est irréversible — bloquée si la valeur est encore utilisée par un enregistrement existant.`}
          confirmLabel="Supprimer"
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          isConfirming={pendingId === deleteTarget.id}
        />
      ) : null}

      <AdminFeedback notice={notice} error={error} onDismissNotice={() => setNotice(null)} onDismissError={() => setError(null)} />
    </div>
  );
}
